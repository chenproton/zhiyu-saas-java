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

	cfg := h.Service.Store().PositionAbilities().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListAbilityBindings(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PositionAbilityBinding]{Items: items, Total: total})
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

	// 校验岗位归属当前租户（与 Update/Delete 一致），防止跨租户写绑定
	posTenant, err := h.Service.PositionTenantID(r.Context(), req.CareerPositionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, posTenant) {
		return
	}
	// 职责必须属于当前岗位（岗位租户已校验），能力点必须属于当前租户（防跨租户引用）
	if resp, err := h.Service.GetResponsibility(r.Context(), req.ResponsibilityID); err != nil || resp.CareerPositionID != req.CareerPositionID {
		respondError(w, http.StatusNotFound, "职责不存在")
		return
	}
	if _, err := h.Service.Store().Abilities().Get(r.Context(), req.AbilityPointID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
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
		respondServerError(w, r, err, "创建绑定失败")
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
	binding, err := h.Service.GetAbilityBinding(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "绑定不存在")
		return
	}
	positionTenantID, err := h.Service.PositionTenantID(r.Context(), binding.CareerPositionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, positionTenantID) {
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
	if req.CareerPositionID != binding.CareerPositionID {
		newPositionTenantID, err := h.Service.PositionTenantID(r.Context(), req.CareerPositionID)
		if err != nil {
			respondError(w, http.StatusNotFound, "岗位不存在")
			return
		}
		if !verifyTenantOwnership(w, r, newPositionTenantID) {
			return
		}
	}
	// 部分更新兜底：非必填字段未携带回退已有值（防全列覆盖清空 source/domain/weight 等）
	if req.Source == "" {
		req.Source = string(binding.Source)
	}
	if req.Domain == nil {
		req.Domain = binding.Domain
	}
	if req.RubricDescription == nil {
		req.RubricDescription = binding.RubricDescription
	}
	if req.Attributes == nil {
		req.Attributes = binding.Attributes
	}
	if req.Weight == 0 {
		req.Weight = binding.Weight
	}

	binding, err = h.Service.UpdateAbilityBinding(r.Context(), id, &store.PositionAbilityParams{
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
		respondServerError(w, r, err, "更新绑定失败")
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
	binding, err := h.Service.GetAbilityBinding(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "绑定不存在")
		return
	}
	positionTenantID, err := h.Service.PositionTenantID(r.Context(), binding.CareerPositionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, positionTenantID) {
		return
	}
	if err := h.Service.DeleteAbilityBinding(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
