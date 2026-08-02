package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ResourceCodeHandler struct {
	Service *service.PositionService
}
type CreateResourceCodeRequest struct {
	TenantID    string  `json:"tenantId"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Type        string  `json:"type"`
}

type UpdateResourceCodeRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Type        string  `json:"type"`
}

func (h *ResourceCodeHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := h.Service.Store().ResourceCodes().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListResourceCodes(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询资源编码失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ResourceCode]{Items: items, Total: total})
}

func (h *ResourceCodeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	resourceCode, err := h.Service.GetResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源编码不存在")
		return
	}
	if !verifyTenantOwnership(w, r, resourceCode.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, resourceCode)
}

func (h *ResourceCodeHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req CreateResourceCodeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TenantID == "" || req.Code == "" || req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}
	resourceCode, err := h.Service.CreateResourceCode(r.Context(), &store.ResourceCodeParams{
		TenantID: req.TenantID, Code: req.Code, Name: req.Name, Description: req.Description, Type: req.Type,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "资源编码代码已存在，请使用其他代码")
			return
		}
		respondServerError(w, r, err, "创建资源编码失败")
		return
	}
	respondJSON(w, http.StatusCreated, resourceCode)
}

func (h *ResourceCodeHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Service.GetResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源编码不存在")
		return
	}
	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}
	var req UpdateResourceCodeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	resourceCode, err := h.Service.UpdateResourceCode(r.Context(), id, &store.ResourceCodeParams{
		Name: req.Name, Description: req.Description, Type: req.Type,
	})
	if err != nil {
		respondServerError(w, r, err, "更新资源编码失败")
		return
	}
	respondJSON(w, http.StatusOK, resourceCode)
}

func (h *ResourceCodeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Service.GetResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源编码不存在")
		return
	}
	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}
	if err := h.Service.DeleteResourceCode(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除资源编码失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
