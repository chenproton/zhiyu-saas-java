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

type PositionResponsibilityListResponse struct {
	Items []domain.PositionResponsibility `json:"items"`
	Total int                             `json:"total"`
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

	cfg := store.ListQueryConfig[domain.PositionResponsibility]{
		Table:         "position_responsibilities",
		SelectColumns: "id, career_position_id, name, description, sort_order",
		TenantScoped:  false,
		OrderBy:       "sort_order ASC, id ASC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if careerPositionID := p.Values["careerPositionId"]; careerPositionID != "" {
				qb.AddCondition("career_position_id = " + qb.NextArg(careerPositionID))
			}
		},
	}
	params, _ := listParamsFromRequest(r, false)
	items, total, err := h.Service.ListResponsibilities(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询岗位职责失败")
		return
	}
	respondJSON(w, http.StatusOK, PositionResponsibilityListResponse{Items: items, Total: total})
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

	item, err := h.Service.CreateResponsibility(r.Context(), &store.PositionResponsibilityParams{
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
	if _, err := h.Service.GetResponsibility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "岗位职责不存在")
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

	item, err := h.Service.UpdateResponsibility(r.Context(), id, &store.PositionResponsibilityParams{
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
	if _, err := h.Service.GetResponsibility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "岗位职责不存在")
		return
	}
	if err := h.Service.DeleteResponsibility(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除岗位职责失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
