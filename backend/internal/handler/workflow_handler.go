package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type WorkflowHandler struct {
	DB *pgxpool.Pool
}

type WorkflowListResponse struct {
	Items []domain.Workflow `json:"items"`
	Total int               `json:"total"`
}

type CreateWorkflowRequest struct {
	Name        string            `json:"name"`
	Scene       *string           `json:"scene"`
	Description *string           `json:"description"`
	Steps       domain.JSONSlice  `json:"steps"`
	MajorIds    domain.StringSlice `json:"majorIds"`
}

type UpdateWorkflowRequest struct {
	Name        string            `json:"name"`
	Scene       *string           `json:"scene"`
	Description *string           `json:"description"`
	Steps       domain.JSONSlice  `json:"steps"`
	MajorIds    domain.StringSlice `json:"majorIds"`
	Status      string            `json:"status"`
}

func (h *WorkflowHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	scene := r.URL.Query().Get("scene")
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if scene != "" {
		where = append(where, "scene = $"+itoa(argIdx))
		args = append(args, scene)
		argIdx++
	}
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		where = append(where, "name ILIKE $"+itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM workflows WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, name, scene, description, steps, major_ids, usage_count, status, created_at
		FROM workflows
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list workflows")
		return
	}
	defer rows.Close()

	items, err := h.scanWorkflowRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan workflows")
		return
	}

	respondJSON(w, http.StatusOK, WorkflowListResponse{Items: items, Total: total})
}

func (h *WorkflowHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	workflow, err := h.fetchWorkflow(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "workflow not found")
		return
	}
	respondJSON(w, http.StatusOK, workflow)
}

func (h *WorkflowHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	if req.Steps == nil {
		req.Steps = domain.JSONSlice{}
	}
	if req.MajorIds == nil {
		req.MajorIds = domain.StringSlice{}
	}

	id := uuid.NewString()
	status := domain.WorkflowStatusActive

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO workflows (id, tenant_id, name, scene, description, steps, major_ids, usage_count, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8)
	`, id, claims.TenantID, req.Name, req.Scene, req.Description, req.Steps, req.MajorIds, status)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "工作流名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create workflow")
		return
	}

	workflow, _ := h.fetchWorkflow(r.Context(), id)
	respondJSON(w, http.StatusCreated, workflow)
}

func (h *WorkflowHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchWorkflow(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "workflow not found")
		return
	}

	var req UpdateWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	if req.Status == "" {
		req.Status = string(existing.Status)
	}
	if req.Status != string(domain.WorkflowStatusActive) && req.Status != string(domain.WorkflowStatusInactive) {
		respondError(w, http.StatusBadRequest, "invalid status")
		return
	}

	if req.Steps == nil {
		req.Steps = domain.JSONSlice{}
	}
	if req.MajorIds == nil {
		req.MajorIds = domain.StringSlice{}
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE workflows SET
			name = $1, scene = $2, description = $3, steps = $4, major_ids = $5, status = $6
		WHERE id = $7
	`, req.Name, req.Scene, req.Description, req.Steps, req.MajorIds, req.Status, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "工作流名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update workflow")
		return
	}

	workflow, _ := h.fetchWorkflow(r.Context(), id)
	respondJSON(w, http.StatusOK, workflow)
}

func (h *WorkflowHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchWorkflow(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "workflow not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM workflows WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete workflow")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *WorkflowHandler) fetchWorkflow(ctx context.Context, id string) (domain.Workflow, error) {
	var w domain.Workflow
	var tenantID, scene, description *string
	var steps domain.JSONSlice

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, scene, description, steps, major_ids, usage_count, status, created_at
		FROM workflows WHERE id = $1
	`, id).Scan(
		&w.ID, &tenantID, &w.Name, &scene, &description, &steps, &w.MajorIds, &w.UsageCount, &w.Status, &w.CreatedAt,
	)
	if err != nil {
		return w, err
	}
	w.TenantID = tenantID
	w.Scene = scene
	w.Description = description
	w.Steps = steps
	return w, nil
}

func (h *WorkflowHandler) scanWorkflowRows(rows pgx.Rows) ([]domain.Workflow, error) {
	items := make([]domain.Workflow, 0)
	for rows.Next() {
		var w domain.Workflow
		var tenantID, scene, description *string
		var steps domain.JSONSlice
		if err := rows.Scan(
			&w.ID, &tenantID, &w.Name, &scene, &description, &steps, &w.MajorIds, &w.UsageCount, &w.Status, &w.CreatedAt,
		); err != nil {
			return nil, err
		}
		w.TenantID = tenantID
		w.Scene = scene
		w.Description = description
		w.Steps = steps
		items = append(items, w)
	}
	return items, nil
}
