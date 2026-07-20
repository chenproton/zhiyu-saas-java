package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type TaskResourceHandler struct {
	DB *pgxpool.Pool
}

type TaskResourceListResponse struct {
	Items []domain.TaskResource `json:"items"`
	Total int                   `json:"total"`
}

type TaskResourceBindingListResponse struct {
	Items []domain.TaskResourceBinding `json:"items"`
	Total int                          `json:"total"`
}

type CreateTaskResourceRequest struct {
	Name              string           `json:"name"`
	Type              string           `json:"type"`
	URL               *string          `json:"url"`
	Description       *string          `json:"description"`
	Thumbnail         *string          `json:"thumbnail"`
	Size              *string          `json:"size"`
	KnowledgePointIDs []string         `json:"knowledgePointIds"`
	ExtraData         domain.JSONMap   `json:"extraData"`
}

type BindTaskResourceRequest struct {
	TaskID     string `json:"taskId"`
	ResourceID string `json:"resourceId"`
}

func (h *TaskResourceHandler) ListResources(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	taskID := r.URL.Query().Get("taskId")
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

	if taskID != "" {
		where = append(where, "EXISTS (SELECT 1 FROM task_resource_bindings tb WHERE tb.resource_id = tr.id AND tb.task_id = $"+itoa(argIdx)+")")
		args = append(args, taskID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(tr.name ILIKE $"+itoa(argIdx)+" OR tr.description ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM task_resources tr WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT tr.id, tr.name, tr.type, tr.url, tr.description, tr.thumbnail, tr.uploaded_by, tr.uploaded_at
		FROM task_resources tr
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY tr.uploaded_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list resources")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan resources")
		return
	}

	respondJSON(w, http.StatusOK, TaskResourceListResponse{Items: items, Total: total})
}

func (h *TaskResourceHandler) BindResource(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req BindTaskResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TaskID == "" || req.ResourceID == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var id string
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO task_resource_bindings (tenant_id, task_id, resource_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (task_id, resource_id) DO UPDATE SET task_id = EXCLUDED.task_id
		RETURNING id
	`, tenantID, req.TaskID, req.ResourceID).Scan(&id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to bind resource")
		return
	}

	binding, _ := h.fetchBinding(r.Context(), id)
	respondJSON(w, http.StatusOK, binding)
}

func (h *TaskResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `DELETE FROM task_resource_bindings WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to unbind resource")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *TaskResourceHandler) fetchBinding(ctx context.Context, id string) (*domain.TaskResourceBinding, error) {
	var b domain.TaskResourceBinding
	err := h.DB.QueryRow(ctx, `SELECT id, task_id, resource_id FROM task_resource_bindings WHERE id = $1`, id).Scan(
		&b.ID, &b.TaskID, &b.ResourceID,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (h *TaskResourceHandler) scanResourceRows(rows pgx.Rows) ([]domain.TaskResource, error) {
	items := make([]domain.TaskResource, 0)
	for rows.Next() {
		var res domain.TaskResource
		if err := rows.Scan(&res.ID, &res.Name, &res.Type, &res.URL, &res.Description, &res.Thumbnail, &res.UploadedBy, &res.UploadedAt); err != nil {
			return nil, err
		}
		items = append(items, res)
	}
	return items, nil
}
