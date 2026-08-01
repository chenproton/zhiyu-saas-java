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

type ScenarioGradeHandler struct {
	Service *service.ScenarioConfigService
}

type ScenarioGradeMappingListResponse struct {
	Items []domain.ScenarioGradeMapping `json:"items"`
	Total int                           `json:"total"`
}

type UpsertScenarioGradeMappingRequest struct {
	ID          string  `json:"id"`
	ScenarioID  string  `json:"scenarioId"`
	TaskID      *string `json:"taskId"`
	Level       string  `json:"level"`
	MinScore    float64 `json:"minScore"`
	MaxScore    float64 `json:"maxScore"`
	Description *string `json:"description"`
	Color       *string `json:"color"`
}

func (h *ScenarioGradeHandler) ListGradeMappings(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	cfg := store.ListQueryConfig[domain.ScenarioGradeMapping]{
		Table:         "scenario_grade_mappings",
		SelectColumns: "id, scenario_id, task_id, level, min_score, max_score, description, color",
		TenantScoped:  true,
		OrderBy:       "min_score ASC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if scenarioID := p.Values["scenarioId"]; scenarioID != "" {
				qb.AddCondition("scenario_id = " + qb.NextArg(scenarioID))
			}
			if taskID := p.Values["taskId"]; taskID != "" {
				qb.AddCondition("task_id = " + qb.NextArg(taskID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListGradeMappings(r.Context(), params, cfg)
	if err != nil {
		slog.Error("查询场景等级映射列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询场景等级映射列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ScenarioGradeMappingListResponse{Items: items, Total: total})
}

func (h *ScenarioGradeHandler) UpsertGradeMapping(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req UpsertScenarioGradeMappingRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ScenarioID == "" || req.Level == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	m, err := h.Service.UpsertGradeMapping(r.Context(), tenantID, &store.ScenarioGradeUpsertParams{
		ID:          req.ID,
		ScenarioID:  req.ScenarioID,
		TaskID:      req.TaskID,
		Level:       req.Level,
		MinScore:    req.MinScore,
		MaxScore:    req.MaxScore,
		Description: req.Description,
		Color:       req.Color,
	})
	if err != nil {
		respondServerError(w, r, err, "更新或创建成绩映射失败")
		return
	}
	respondJSON(w, http.StatusOK, m)
}

func (h *ScenarioGradeHandler) DeleteGradeMapping(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.Service.DeleteGradeMapping(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除成绩映射失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
