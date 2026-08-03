package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PositionResponsibilityHandler struct {
	Service *service.PositionConfigService
}
type CreatePositionResponsibilityRequest struct {
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	SortOrder        int     `json:"sortOrder"`
}

type UpdatePositionResponsibilityRequest = CreatePositionResponsibilityRequest

func (h *PositionResponsibilityHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().PositionResponsibilities().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListResponsibilities(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询岗位职责失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PositionResponsibility]{Items: items, Total: total})
}

func (h *PositionResponsibilityHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.Service.GetResponsibility(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位职责不存在")
		return
	}
	positionTenantID, err := h.Service.PositionTenantID(r.Context(), item.CareerPositionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, positionTenantID) {
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *PositionResponsibilityHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreatePositionResponsibilityRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	positionTenantID, err := h.Service.PositionTenantID(r.Context(), req.CareerPositionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, positionTenantID) {
		return
	}

	item, err := h.Service.CreateResponsibility(r.Context(), &store.PositionResponsibilityParams{
		TenantID:         positionTenantID,
		CareerPositionID: req.CareerPositionID,
		Name:             req.Name,
		Description:      req.Description,
		SortOrder:        req.SortOrder,
	})
	if err != nil {
		respondServerError(w, r, err, "创建岗位职责失败")
		return
	}
	respondJSON(w, http.StatusCreated, item)
}

func (h *PositionResponsibilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.Service.GetResponsibility(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位职责不存在")
		return
	}
	positionTenantID, err := h.Service.PositionTenantID(r.Context(), item.CareerPositionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, positionTenantID) {
		return
	}

	var req UpdatePositionResponsibilityRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	item, err = h.Service.UpdateResponsibility(r.Context(), id, &store.PositionResponsibilityParams{
		CareerPositionID: req.CareerPositionID,
		Name:             req.Name,
		Description:      req.Description,
		SortOrder:        req.SortOrder,
	})
	if err != nil {
		respondServerError(w, r, err, "更新岗位职责失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *PositionResponsibilityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.Service.GetResponsibility(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位职责不存在")
		return
	}
	positionTenantID, err := h.Service.PositionTenantID(r.Context(), item.CareerPositionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, positionTenantID) {
		return
	}
	if err := h.Service.DeleteResponsibility(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除岗位职责失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
