package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PositionAbilityHandler struct {
	Service *service.PositionConfigService
}

type PositionAbilityListResponse struct {
	Items []domain.PositionAbilityBinding `json:"items"`
	Total int                             `json:"total"`
}

type CreatePositionAbilityRequest struct {
	CareerPositionID  string   `json:"careerPositionId"`
	ResponsibilityID  string   `json:"responsibilityId"`
	AbilityPointID    string   `json:"abilityPointId"`
	Source            string   `json:"source"`
	Domain            *string  `json:"domain"`
	RequiredLevel     string   `json:"requiredLevel"`
	RubricDescription *string  `json:"rubricDescription"`
	Attributes        []string `json:"attributes"`
	Weight            float64  `json:"weight"`
}

type UpdatePositionAbilityRequest = CreatePositionAbilityRequest

func (h *PositionAbilityHandler) ListBindings(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := store.ListQueryConfig[domain.PositionAbilityBinding]{
		Table:         "position_ability_bindings",
		SelectColumns: "id, career_position_id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, attributes, weight",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if careerPositionID := p.Values["careerPositionId"]; careerPositionID != "" {
				qb.AddCondition("career_position_id = " + qb.NextArg(careerPositionID))
			}
			if responsibilityID := p.Values["responsibilityId"]; responsibilityID != "" {
				qb.AddCondition("responsibility_id = " + qb.NextArg(responsibilityID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListAbilityBindings(r.Context(), params, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, PositionAbilityListResponse{Items: items, Total: total})
}

func (h *PositionAbilityHandler) CreateBinding(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreatePositionAbilityRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" || req.ResponsibilityID == "" || req.AbilityPointID == "" || req.RequiredLevel == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Source == "" {
		req.Source = "custom"
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	binding, err := h.Service.CreateAbilityBinding(r.Context(), tenantID, &store.PositionAbilityParams{
		CareerPositionID:  req.CareerPositionID,
		ResponsibilityID:  req.ResponsibilityID,
		AbilityPointID:    req.AbilityPointID,
		Source:            req.Source,
		Domain:            req.Domain,
		RequiredLevel:     req.RequiredLevel,
		RubricDescription: req.RubricDescription,
		Attributes:        coalesceStringSlice(req.Attributes),
		Weight:            req.Weight,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建绑定失败")
		return
	}
	respondJSON(w, http.StatusCreated, binding)
}

func (h *PositionAbilityHandler) UpdateBinding(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetAbilityBinding(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "绑定不存在")
		return
	}

	var req UpdatePositionAbilityRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" || req.ResponsibilityID == "" || req.AbilityPointID == "" || req.RequiredLevel == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	binding, err := h.Service.UpdateAbilityBinding(r.Context(), id, &store.PositionAbilityParams{
		CareerPositionID:  req.CareerPositionID,
		ResponsibilityID:  req.ResponsibilityID,
		AbilityPointID:    req.AbilityPointID,
		Source:            req.Source,
		Domain:            req.Domain,
		RequiredLevel:     req.RequiredLevel,
		RubricDescription: req.RubricDescription,
		Attributes:        coalesceStringSlice(req.Attributes),
		Weight:            req.Weight,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, binding)
}

func (h *PositionAbilityHandler) DeleteBinding(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetAbilityBinding(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "绑定不存在")
		return
	}
	if err := h.Service.DeleteAbilityBinding(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
