package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type UserExtensionFieldHandler struct {
	Service *service.UserExtensionFieldService
}

type UserExtensionFieldListResponse struct {
	Items []domain.UserExtensionField `json:"items"`
}

type UpdateUserExtensionFieldRequest struct {
	FieldName           string   `json:"fieldName"`
	IsEnabled           bool     `json:"isEnabled"`
	IsRequired          bool     `json:"isRequired"`
	ApplicableRoleCodes []string `json:"applicableRoleCodes"`
}

func (h *UserExtensionFieldHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	items, err := h.Service.List(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "确保default extension fields失败")
		return
	}
	respondJSON(w, http.StatusOK, UserExtensionFieldListResponse{Items: items})
}

func (h *UserExtensionFieldHandler) Update(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	existing, err := h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "扩展字段不存在")
		return
	}
	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdateUserExtensionFieldRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.FieldName == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	updated, err := h.Service.Update(r.Context(), existing.TenantID, id, &store.UserExtensionFieldUpdateParams{
		FieldName:           req.FieldName,
		IsEnabled:           req.IsEnabled,
		IsRequired:          req.IsRequired,
		ApplicableRoleCodes: req.ApplicableRoleCodes,
	})
	if err != nil {
		respondServerError(w, r, err, "更新扩展字段失败")
		return
	}
	respondJSON(w, http.StatusOK, updated)
}
