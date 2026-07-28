package handler

import (
	"context"
	"encoding/json"
	"net/http"

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
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	items, total, err := executeListQuery[domain.Workflow](r.Context(), h.DB, r, listQueryConfig[domain.Workflow]{
		Table:         "workflows",
		SelectColumns: "id, tenant_id, name, scene, description, steps, major_ids, usage_count, status, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if scene := r.URL.Query().Get("scene"); scene != "" {
				qb.addCondition("scene = " + qb.nextArg(scene))
			}
			if status := r.URL.Query().Get("status"); status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
	}, h.scanWorkflowRows)
	if err != nil {
		if err.Error() == "missing tenant" {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询审批流程失败")
		return
	}

	respondJSON(w, http.StatusOK, WorkflowListResponse{Items: items, Total: total})
}

func (h *WorkflowHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	workflow, err := h.fetchWorkflow(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "审批流程不存在")
		return
	}
	if workflow.TenantID != nil && !verifyTenantOwnership(w, r, *workflow.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, workflow)
}

func (h *WorkflowHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
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
		respondError(w, http.StatusInternalServerError, "创建审批流程失败")
		return
	}

	workflow, _ := h.fetchWorkflow(r.Context(), id)
	respondJSON(w, http.StatusCreated, workflow)
}

func (h *WorkflowHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchWorkflow(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "审批流程不存在")
		return
	}
	if existing.TenantID != nil && !verifyTenantOwnership(w, r, *existing.TenantID) {
		return
	}

	var req UpdateWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if req.Status == "" {
		req.Status = string(existing.Status)
	}
	if req.Status != string(domain.WorkflowStatusActive) && req.Status != string(domain.WorkflowStatusInactive) {
		respondError(w, http.StatusBadRequest, "无效状态")
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
		respondError(w, http.StatusInternalServerError, "更新审批流程失败")
		return
	}

	workflow, _ := h.fetchWorkflow(r.Context(), id)
	respondJSON(w, http.StatusOK, workflow)
}

func (h *WorkflowHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	workflow, err := h.fetchWorkflow(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "审批流程不存在")
		return
	}
	if workflow.TenantID != nil && !verifyTenantOwnership(w, r, *workflow.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM workflows WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除审批流程失败")
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
