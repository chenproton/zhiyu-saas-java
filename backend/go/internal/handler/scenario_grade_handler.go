package handler

import (
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

	cfg := h.Service.Store().ScenarioGrades().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListGradeMappings(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询场景等级映射列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ScenarioGradeMapping]{Items: items, Total: total})
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
		existingScenarioID, err := h.Service.GradeScenarioID(r.Context(), req.ID)
		if err != nil {
			respondError(w, http.StatusNotFound, "等级映射不存在")
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
