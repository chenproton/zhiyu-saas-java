package handler

import (
	"errors"
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

	cfg := h.Service.Store().ScenarioTasks().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	// 学生仅可查已发布场景的任务（防枚举未发布场景任务）；不带 scenarioId 的
	// 列表请求对学生会返回全租户任务，一律拒绝为空列表
	if middleware.HasRole(middleware.CurrentUser(r), domain.RoleStudent) {
		scenarioID := params.Values["scenarioId"]
		if scenarioID == "" {
			respondJSON(w, http.StatusOK, ListResponse[domain.ScenarioTask]{Items: []domain.ScenarioTask{}, Total: 0})
			return
		}
		sc, err := h.Service.Get(r.Context(), scenarioID)
		if err != nil || sc.Status != domain.StatusPublished {
			respondJSON(w, http.StatusOK, ListResponse[domain.ScenarioTask]{Items: []domain.ScenarioTask{}, Total: 0})
			return
		}
	}
	items, total, err := h.Service.ListTasks(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询任务失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ScenarioTask]{Items: items, Total: total})
}

// applyTaskPartialUpdate 任务部分更新兜底：未携带字段回退已有值（防全列覆盖清空）。
// portal 与共建端共用，保证两端部分更新语义一致。
func applyTaskPartialUpdate(req *CreateScenarioTaskRequest, task *domain.ScenarioTask) {
	if req.ScenarioID == "" && task.ScenarioID != "" {
		req.ScenarioID = task.ScenarioID
	}
	if req.Name == "" {
		req.Name = task.Name
	}
	if req.Code == "" {
		req.Code = task.Code
	}
	if req.TaskType == "" {
		req.TaskType = task.TaskType
	}
	if req.Difficulty == nil {
		d := task.Difficulty
		req.Difficulty = &d
	}
	if req.Description == nil {
		req.Description = task.Description
	}
	if req.DetailedDescription == nil {
		req.DetailedDescription = task.DetailedDescription
	}
	if req.DescriptionPdf == nil {
		req.DescriptionPdf = task.DescriptionPdf
	}
	if req.Background == nil {
		req.Background = task.Background
	}
	if req.SourceScenarioID == nil {
		req.SourceScenarioID = task.SourceScenarioID
	}
	if req.SortOrder == 0 {
		req.SortOrder = task.SortOrder
	}
	if req.EstimatedHours == 0 {
		req.EstimatedHours = task.EstimatedHours
	}
	if !req.IsReferenced {
		req.IsReferenced = task.IsReferenced
	}
	if req.DependencyIDs == nil {
		req.DependencyIDs = task.DependencyIDs
	}
	if req.KnowledgePointIDs == nil {
		req.KnowledgePointIDs = task.KnowledgePointIDs
	}
	if req.AbilityPointIDs == nil {
		req.AbilityPointIDs = task.AbilityPointIDs
	}
	if req.ResourceIDs == nil {
		req.ResourceIDs = task.ResourceIDs
	}
	// EvalData 未携带时回退现有值（前端任务保存不提交 evalData，防止被清空为 {}）
	if req.EvalData == nil {
		req.EvalData = task.EvalData
	}
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
	// 租户缺失一律拒绝，不可在任一缺失时跳过校验
	if task.TenantID == nil || !verifyTenantOwnership(w, r, *task.TenantID) {
		return
	}
	// 学生仅可查看已发布场景的任务（防枚举未发布场景任务，与 List 口径一致）
	if middleware.HasRole(middleware.CurrentUser(r), domain.RoleStudent) {
		sc, err := h.Service.Get(r.Context(), task.ScenarioID)
		if err != nil || sc.Status != domain.StatusPublished {
			respondError(w, http.StatusNotFound, "任务不存在")
			return
		}
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

	applyTaskPartialUpdate(&req, task)

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
		if errors.Is(err, store.ErrResourceInUse) {
			respondError(w, http.StatusConflict, "该任务已存在测评成绩，无法删除")
			return
		}
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
