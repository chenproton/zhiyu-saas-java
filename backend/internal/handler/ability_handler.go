package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AbilityHandler struct {
	Service *service.PositionService
}

type AbilityListResponse struct {
	Items []domain.AbilityPoint `json:"items"`
	Total int                   `json:"total"`
}

type CreateAbilityRequest struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Category    string   `json:"category"`
	Attributes  []string `json:"attributes"`
	IsPublic    bool     `json:"isPublic"`
}

type UpdateAbilityRequest struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Category    string   `json:"category"`
	Attributes  []string `json:"attributes"`
	IsPublic    bool     `json:"isPublic"`
}

func (h *AbilityHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	isPublic := r.URL.Query().Get("isPublic") == "true"
	cfg := store.ListQueryConfig[domain.AbilityPoint]{
		Table:         "ability_points",
		SelectColumns: "id, name, code, description, category, attributes, is_public, creator_id, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "description"},
		ScanRows:      store.ScanAbilityPointRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if isPublic {
				qb.AddCondition("is_public = " + qb.NextArg(true))
			}
			if category := p.Values["category"]; category != "" {
				qb.AddCondition("category = " + qb.NextArg(category))
			}
			if creatorID := p.Values["creatorId"]; creatorID != "" {
				qb.AddCondition("creator_id = " + qb.NextArg(creatorID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListAbilities(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询列表失败")
		return
	}
	respondJSON(w, http.StatusOK, AbilityListResponse{Items: items, Total: total})
}

func (h *AbilityHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	ability, err := h.Service.GetAbility(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
		return
	}
	respondJSON(w, http.StatusOK, ability)
}

func (h *AbilityHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req CreateAbilityRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Category == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ability, err := h.Service.CreateAbility(r.Context(), tenantID, &store.AbilityPointParams{
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Attributes:  coalesceStringSlice(req.Attributes),
		IsPublic:    req.IsPublic,
		CreatorID:   claims.UserID,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "能力点名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "创建能力点失败")
		return
	}
	respondJSON(w, http.StatusCreated, ability)
}

func (h *AbilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetAbility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
		return
	}
	var req UpdateAbilityRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Category == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	ability, err := h.Service.UpdateAbility(r.Context(), id, &store.AbilityPointParams{
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Attributes:  coalesceStringSlice(req.Attributes),
		IsPublic:    req.IsPublic,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "能力点名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "更新能力点失败")
		return
	}
	respondJSON(w, http.StatusOK, ability)
}

func (h *AbilityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetAbility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
		return
	}
	if err := h.Service.DeleteAbility(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除能力点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
