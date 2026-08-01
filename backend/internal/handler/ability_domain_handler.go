package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AbilityDomainHandler struct {
	Service *service.PositionService
}

type AbilityDomainListResponse struct {
	Items []domain.AbilityDomain `json:"items"`
	Total int                    `json:"total"`
}

type CreateAbilityDomainRequest struct {
	CareerPositionID string   `json:"careerPositionId"`
	Name             string   `json:"name"`
	Description      *string  `json:"description"`
	BindingIDs       []string `json:"bindingIds"`
	SortOrder        int      `json:"sortOrder"`
}

type UpdateAbilityDomainRequest struct {
	CareerPositionID string   `json:"careerPositionId"`
	Name             string   `json:"name"`
	Description      *string  `json:"description"`
	BindingIDs       []string `json:"bindingIds"`
	SortOrder        int      `json:"sortOrder"`
}

func (h *AbilityDomainHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	careerPositionID := r.URL.Query().Get("careerPositionId")
	cfg := store.ListQueryConfig[domain.AbilityDomain]{
		Table:         "ability_domains",
		SelectColumns: "id, tenant_id, career_position_id, name, description, binding_ids, sort_order",
		TenantScoped:  true,
		OrderBy:       "sort_order ASC",
		ScanRows:      store.ScanAbilityDomainRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if careerPositionID != "" {
				qb.AddCondition("career_position_id = " + qb.NextArg(careerPositionID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListAbilityDomains(r.Context(), params, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询能力域失败")
		return
	}
	respondJSON(w, http.StatusOK, AbilityDomainListResponse{Items: items, Total: total})
}

func (h *AbilityDomainHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req CreateAbilityDomainRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	d, err := h.Service.CreateAbilityDomain(r.Context(), tenantID, &store.AbilityDomainParams{
		CareerPositionID: req.CareerPositionID,
		Name:             req.Name,
		Description:      req.Description,
		BindingIDs:       coalesceStringSlice(req.BindingIDs),
		SortOrder:        req.SortOrder,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建能力域失败")
		return
	}
	respondJSON(w, http.StatusCreated, d)
}

func (h *AbilityDomainHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	d, err := h.Service.GetAbilityDomain(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力域不存在")
		return
	}
	if d.TenantID != nil && !verifyTenantOwnership(w, r, *d.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, d)
}

func (h *AbilityDomainHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	d, err := h.Service.GetAbilityDomain(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力域不存在")
		return
	}
	if d.TenantID != nil && !verifyTenantOwnership(w, r, *d.TenantID) {
		return
	}
	var req UpdateAbilityDomainRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	d, err = h.Service.UpdateAbilityDomain(r.Context(), id, &store.AbilityDomainParams{
		CareerPositionID: req.CareerPositionID,
		Name:             req.Name,
		Description:      req.Description,
		BindingIDs:       coalesceStringSlice(req.BindingIDs),
		SortOrder:        req.SortOrder,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新能力域失败")
		return
	}
	respondJSON(w, http.StatusOK, d)
}

func (h *AbilityDomainHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	d, err := h.Service.GetAbilityDomain(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力域不存在")
		return
	}
	if d.TenantID != nil && !verifyTenantOwnership(w, r, *d.TenantID) {
		return
	}
	if err := h.Service.DeleteAbilityDomain(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除能力域失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
