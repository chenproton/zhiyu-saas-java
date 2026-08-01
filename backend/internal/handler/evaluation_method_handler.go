package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type EvaluationMethodHandler struct {
	Service *service.EvaluationService
}

type EvaluationMethodCategoryListResponse struct {
	Items []domain.EvaluationMethodCategory `json:"items"`
	Total int                               `json:"total"`
}

type EvaluationMethodListResponse struct {
	Items []domain.EvaluationMethod `json:"items"`
	Total int                       `json:"total"`
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
	items, err := h.Service.ListEvaluationCategories(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询分类失败")
		return
	}
	respondJSON(w, http.StatusOK, EvaluationMethodCategoryListResponse{Items: items, Total: len(items)})
}

func (h *EvaluationMethodHandler) ListMethods(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := store.ListQueryConfig[domain.EvaluationMethod]{
		Table:         "evaluation_methods",
		SelectColumns: "id, category_id, name, enabled, sub_category_name, description, doc_link",
		TenantScoped:  true,
		OrderBy:       "name",
		ScanRows:      store.ScanEvaluationMethodRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if categoryID := p.Values["categoryId"]; categoryID != "" {
				qb.AddCondition("category_id = " + qb.NextArg(categoryID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListEvaluationMethods(r.Context(), params, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询测评方式失败")
		return
	}
	respondJSON(w, http.StatusOK, EvaluationMethodListResponse{Items: items, Total: total})
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
	if _, err := h.Service.GetEvaluationMethod(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "测评方式不存在")
		return
	}
	method, err := h.Service.ToggleEvaluationMethod(r.Context(), id, req.Enabled)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "切换测评方式失败")
		return
	}
	respondJSON(w, http.StatusOK, method)
}
