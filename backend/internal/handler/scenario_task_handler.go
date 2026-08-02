package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ScenarioTaskHandler struct {
	Service *service.ScenarioService
}
type CreateScenarioTaskRequest struct {
	ScenarioID          string         `json:"scenarioId"`
	Name                string         `json:"name"`
	Code                string         `json:"code"`
	SortOrder           int            `json:"sortOrder"`
	Description         *string        `json:"description"`
	DetailedDescription *string        `json:"detailedDescription"`
	DescriptionPdf      *string        `json:"descriptionPdf"`
	EstimatedHours      float64        `json:"estimatedHours"`
	TaskType            string         `json:"taskType"`
	Difficulty          *int           `json:"difficulty"`
	Background          *string        `json:"background"`
	DependencyIDs       []string       `json:"dependencyIds"`
	IsReferenced        bool           `json:"isReferenced"`
	SourceScenarioID    *string        `json:"sourceScenarioId"`
	KnowledgePointIDs   []string       `json:"knowledgePointIds"`
	AbilityPointIDs     []string       `json:"abilityPointIds"`
	ResourceIDs         []string       `json:"resourceIds"`
	EvalData            domain.JSONMap `json:"evalData"`
}

type ReorderScenarioTasksRequest struct {
	ScenarioID string   `json:"scenarioId"`
	TaskIDs    []string `json:"taskIds"`
}

func (h *ScenarioTaskHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	cfg := store.ListQueryConfig[domain.ScenarioTask]{
		Table:         "scenario_tasks",
		SelectColumns: store.TaskSelectColumns,
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		OrderBy:       "sort_order",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if scenarioID := p.Values["scenarioId"]; scenarioID != "" {
				qb.AddCondition("scenario_id = " + qb.NextArg(scenarioID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListTasks(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询任务失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ScenarioTask]{Items: items, Total: total})
}

func (h *ScenarioTaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	task, err := h.Service.GetTask(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "任务不存在")
		return
	}
	if task.TenantID != nil && !verifyTenantOwnership(w, r, *task.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, task)
}

func (h *ScenarioTaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req CreateScenarioTaskRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ScenarioID == "" || req.Name == "" || req.Code == "" || req.TaskType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
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

	task, err := h.Service.CreateTask(r.Context(), &store.ScenarioTaskParams{
		ScenarioID:          req.ScenarioID,
		Name:                req.Name,
		Code:                req.Code,
		SortOrder:           req.SortOrder,
		Description:         req.Description,
		DetailedDescription: req.DetailedDescription,
		DescriptionPdf:      req.DescriptionPdf,
		EstimatedHours:      req.EstimatedHours,
		TaskType:            req.TaskType,
		Difficulty:          req.Difficulty,
		Background:          req.Background,
		DependencyIDs:       coalesceStringSlice(req.DependencyIDs),
		IsReferenced:        req.IsReferenced,
		SourceScenarioID:    req.SourceScenarioID,
		KnowledgePointIDs:   coalesceStringSlice(req.KnowledgePointIDs),
		AbilityPointIDs:     coalesceStringSlice(req.AbilityPointIDs),
		ResourceIDs:         coalesceStringSlice(req.ResourceIDs),
		EvalData:            jsonMapBytes(req.EvalData),
		TenantID:            scenarioTenantID,
	})
	if err != nil {
		respondServerError(w, r, err, "创建任务失败")
		return
	}
	respondJSON(w, http.StatusCreated, task)
}

func (h *ScenarioTaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	task, err := h.Service.GetTask(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "任务不存在")
		return
	}
	if task.TenantID == nil {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if !verifyTenantOwnership(w, r, *task.TenantID) {
		return
	}

	var req CreateScenarioTaskRequest
	if !decodeBody(w, r, &req) {
		return
	}

	newScenarioTenantID, err := h.Service.ScenarioTenantID(r.Context(), req.ScenarioID)
	if err != nil {
		respondError(w, http.StatusNotFound, "场景不存在")
		return
	}
	if newScenarioTenantID != nil && !verifyTenantOwnership(w, r, *newScenarioTenantID) {
		return
	}

	result, err := h.Service.UpdateTask(r.Context(), id, *task.TenantID, &store.ScenarioTaskParams{
		ScenarioID:          req.ScenarioID,
		Name:                req.Name,
		Code:                req.Code,
		SortOrder:           req.SortOrder,
		Description:         req.Description,
		DetailedDescription: req.DetailedDescription,
		DescriptionPdf:      req.DescriptionPdf,
		EstimatedHours:      req.EstimatedHours,
		TaskType:            req.TaskType,
		Difficulty:          req.Difficulty,
		Background:          req.Background,
		DependencyIDs:       coalesceStringSlice(req.DependencyIDs),
		IsReferenced:        req.IsReferenced,
		SourceScenarioID:    req.SourceScenarioID,
		KnowledgePointIDs:   coalesceStringSlice(req.KnowledgePointIDs),
		AbilityPointIDs:     coalesceStringSlice(req.AbilityPointIDs),
		ResourceIDs:         coalesceStringSlice(req.ResourceIDs),
		EvalData:            jsonMapBytes(req.EvalData),
		TenantID:            newScenarioTenantID,
	})
	if err != nil {
		respondServerError(w, r, err, "更新任务失败")
		return
	}
	respondJSON(w, http.StatusOK, result)
}

func (h *ScenarioTaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	task, err := h.Service.GetTask(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "任务不存在")
		return
	}
	if task.TenantID == nil {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if !verifyTenantOwnership(w, r, *task.TenantID) {
		return
	}

	if err := h.Service.DeleteTask(r.Context(), id, *task.TenantID); err != nil {
		respondServerError(w, r, err, "删除任务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ScenarioTaskHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req ReorderScenarioTasksRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ScenarioID == "" {
		respondError(w, http.StatusBadRequest, "缺少场景ID")
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

	if err := h.Service.ReorderTasks(r.Context(), req.ScenarioID, req.TaskIDs); err != nil {
		respondServerError(w, r, err, "重新排序任务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
