package handler

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ScenarioWeightHandler struct {
	Service *service.ScenarioConfigService
}
type UpsertScenarioWeightRequest struct {
	ID         string  `json:"id"`
	ScenarioID string  `json:"scenarioId"`
	TaskID     string  `json:"taskId"`
	Weight     float64 `json:"weight"`
}

func (h *ScenarioWeightHandler) ListWeights(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	cfg := h.Service.Store().ScenarioWeights().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListWeights(r.Context(), params, cfg)
	if err != nil {
		slog.Error("查询场景权重配置列表失败", "error", err)
		respondServerError(w, r, err, "查询场景权重配置列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ScenarioWeightConfig]{Items: items, Total: total})
}

func (h *ScenarioWeightHandler) UpsertWeight(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req UpsertScenarioWeightRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ScenarioID == "" || req.TaskID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	urlID := chi.URLParam(r, "id")
	if urlID != "" {
		req.ID = urlID
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	scenarioTenantID, err := h.Service.ScenarioTenantID(r.Context(), req.ScenarioID)
	if err != nil {
		respondError(w, http.StatusNotFound, "场景不存在")
		return
	}
	if scenarioTenantID != nil && !verifyTenantOwnership(w, r, *scenarioTenantID) {
		return
	}
	if req.ID != "" {
		existingScenarioID, err := h.Service.WeightScenarioID(r.Context(), req.ID)
		if err != nil {
			respondError(w, http.StatusNotFound, "权重配置不存在")
			return
		}
		existingTenantID, err := h.Service.ScenarioTenantID(r.Context(), existingScenarioID)
		if err != nil {
			respondError(w, http.StatusNotFound, "场景不存在")
			return
		}
		if existingTenantID != nil && !verifyTenantOwnership(w, r, *existingTenantID) {
			return
		}
	}

	wgt, err := h.Service.UpsertWeight(r.Context(), tenantID, &store.ScenarioWeightUpsertParams{
		ID:         req.ID,
		ScenarioID: req.ScenarioID,
		TaskID:     req.TaskID,
		Weight:     req.Weight,
	})
	if err != nil {
		respondServerError(w, r, err, "更新或创建权重失败")
		return
	}
	respondJSON(w, http.StatusOK, wgt)
}
