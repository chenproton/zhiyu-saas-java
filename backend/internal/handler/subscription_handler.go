package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type SubscriptionHandler struct {
	Service *service.PositionService
}

type UpdateSubscriptionRequest struct {
	Name       string         `json:"name"`
	ValidUntil *string        `json:"validUntil"`
	Modules    domain.JSONMap `json:"modules"`
	Status     string         `json:"status"`
}

func (h *SubscriptionHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	sub, err := h.Service.GetSubscriptionByTenant(r.Context(), tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "订阅不存在")
		return
	}
	respondJSON(w, http.StatusOK, sub)
}

func (h *SubscriptionHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetSubscription(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "订阅不存在")
		return
	}
	var req UpdateSubscriptionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Modules == nil {
		req.Modules = domain.JSONMap{}
	}
	sub, err := h.Service.UpdateSubscription(r.Context(), id, &store.SubscriptionUpdateParams{
		Name: req.Name, ValidUntil: req.ValidUntil, Modules: req.Modules, Status: req.Status,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新订阅失败")
		return
	}
	respondJSON(w, http.StatusOK, sub)
}

func (h *SubscriptionHandler) AdminGet(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "缺少租户ID")
		return
	}
	sub, err := h.Service.GetSubscriptionByTenant(r.Context(), tenantID)
	if err != nil {
		respondJSON(w, http.StatusOK, domain.SubscriptionPackage{
			TenantID: tenantID,
			Name:     "",
			Modules:  domain.JSONMap{},
			Status:   "inactive",
		})
		return
	}
	respondJSON(w, http.StatusOK, sub)
}

func (h *SubscriptionHandler) AdminUpdate(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "缺少租户ID")
		return
	}
	var req UpdateSubscriptionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Modules == nil {
		req.Modules = domain.JSONMap{}
	}

	ctx := r.Context()
	existing, err := h.Service.GetSubscriptionByTenant(ctx, tenantID)
	if err == nil && existing.ID != "" {
		updated, err := h.Service.UpdateSubscription(ctx, existing.ID, &store.SubscriptionUpdateParams{
			Name: req.Name, ValidUntil: req.ValidUntil, Modules: req.Modules, Status: req.Status,
		})
		if err != nil {
			respondError(w, http.StatusInternalServerError, "更新订阅失败")
			return
		}
		respondJSON(w, http.StatusOK, updated)
		return
	}

	sub, err := h.Service.CreateSubscription(ctx, &store.SubscriptionUpdateParams{
		TenantID: tenantID, Name: req.Name, ValidUntil: req.ValidUntil, Modules: req.Modules, Status: req.Status,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建订阅失败")
		return
	}
	respondJSON(w, http.StatusOK, sub)
}
