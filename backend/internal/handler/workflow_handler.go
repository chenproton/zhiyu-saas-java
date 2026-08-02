package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type WorkflowHandler struct {
	Service *service.PositionService
}
type CreateWorkflowRequest struct {
	Name        string             `json:"name"`
	Scene       *string            `json:"scene"`
	Description *string            `json:"description"`
	Steps       domain.JSONSlice   `json:"steps"`
	MajorIds    domain.StringSlice `json:"majorIds"`
}

type UpdateWorkflowRequest struct {
	Name        string             `json:"name"`
	Scene       *string            `json:"scene"`
	Description *string            `json:"description"`
	Steps       domain.JSONSlice   `json:"steps"`
	MajorIds    domain.StringSlice `json:"majorIds"`
	Status      string             `json:"status"`
}

func (h *WorkflowHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().Workflows().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListWorkflows(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询审批流程失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.Workflow]{Items: items, Total: total})
}

func (h *WorkflowHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	workflow, err := h.Service.GetWorkflow(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "审批流程不存在")
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
	if !decodeBody(w, r, &req) {
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
	workflow, err := h.Service.CreateWorkflow(r.Context(), claims.TenantID, &store.WorkflowParams{
		Name: req.Name, Scene: req.Scene, Description: req.Description,
		Steps: req.Steps, MajorIds: req.MajorIds, Status: domain.WorkflowStatusActive,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "工作流名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "创建审批流程失败")
		return
	}
	respondJSON(w, http.StatusCreated, workflow)
}

func (h *WorkflowHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Service.GetWorkflow(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "审批流程不存在")
		return
	}
	if existing.TenantID != nil && !verifyTenantOwnership(w, r, *existing.TenantID) {
		return
	}
	var req UpdateWorkflowRequest
	if !decodeBody(w, r, &req) {
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
	workflow, err := h.Service.UpdateWorkflow(r.Context(), id, &store.WorkflowParams{
		Name: req.Name, Scene: req.Scene, Description: req.Description,
		Steps: req.Steps, MajorIds: req.MajorIds, Status: domain.WorkflowStatus(req.Status),
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "工作流名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "更新审批流程失败")
		return
	}
	respondJSON(w, http.StatusOK, workflow)
}

func (h *WorkflowHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Service.GetWorkflow(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "审批流程不存在")
		return
	}
	if existing.TenantID != nil && !verifyTenantOwnership(w, r, *existing.TenantID) {
		return
	}
	if err := h.Service.DeleteWorkflow(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除审批流程失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
