package handler

import (
	"log/slog"
	"net/http"

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

	scenarioID := r.URL.Query().Get("scenarioId")
	taskID := r.URL.Query().Get("taskId")

	cfg := store.ListQueryConfig[domain.ScenarioWeightConfig]{
		Table:         "scenario_weight_configs",
		SelectColumns: "id, scenario_id, task_id, weight",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if scenarioID != "" {
				qb.AddCondition("scenario_id = " + qb.NextArg(scenarioID))
			}
			if taskID != "" {
				qb.AddCondition("task_id = " + qb.NextArg(taskID))
			}
		},
	}
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
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
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
