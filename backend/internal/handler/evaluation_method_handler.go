package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type EvaluationMethodHandler struct {
	Service *service.EvaluationService
}

type ToggleMethodRequest struct {
	Enabled bool `json:"enabled"`
}

func (h *EvaluationMethodHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, err := h.Service.ListEvaluationCategories(r.Context(), *claims.TenantID)
	if err != nil {
		respondServerError(w, r, err, "查询分类失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.EvaluationMethodCategory]{Items: items, Total: len(items)})
}

func (h *EvaluationMethodHandler) ListMethods(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().EvaluationMethods().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListEvaluationMethods(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询测评方式失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.EvaluationMethod]{Items: items, Total: total})
}

func (h *EvaluationMethodHandler) Toggle(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	var req ToggleMethodRequest
	if !decodeBody(w, r, &req) {
		return
	}
	methodTenantID, err := h.Service.Store().EvaluationMethods().TenantID(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "测评方式不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if !verifyTenantOwnership(w, r, methodTenantID) {
		return
	}
	if _, err := h.Service.GetEvaluationMethod(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "测评方式不存在")
		return
	}
	method, err := h.Service.ToggleEvaluationMethod(r.Context(), id, req.Enabled)
	if err != nil {
		respondServerError(w, r, err, "切换测评方式失败")
		return
	}
	respondJSON(w, http.StatusOK, method)
}
