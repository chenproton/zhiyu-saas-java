package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type TaskEvaluationHandler struct {
	Service *service.TaskEvaluationService
}

type TaskEvaluationMethodListResponse struct {
	Methods []domain.TaskEvaluationMethod `json:"methods"`
}

type SaveTaskEvaluationMethodsRequest struct {
	Version int                         `json:"version"`
	Methods []TaskEvaluationMethodInput `json:"methods"`
}

type TaskEvaluationMethodInput struct {
	MethodKey        string            `json:"methodKey"`
	Weight           float64           `json:"weight"`
	EvalObject       string            `json:"evalObject"`
	ScoreType        *string           `json:"scoreType"`
	EvalSubjects     json.RawMessage   `json:"evalSubjects"`
	RubricTemplateID *string           `json:"rubricTemplateId"`
	ResourceConfig   json.RawMessage   `json:"resourceConfig"`
	IsEnabled        bool              `json:"isEnabled"`
	EvalPoints       []EvalPointInput  `json:"evalPoints"`
	ReviewSteps      []ReviewStepInput `json:"reviewSteps"`
}

type EvalPointInput struct {
	Name              string          `json:"name"`
	Description       *string         `json:"description"`
	SubType           *string         `json:"subType"`
	Types             []string        `json:"types"`
	Weight            float64         `json:"weight"`
	ScoringMethod     string          `json:"scoringMethod"`
	GradeMapping      json.RawMessage `json:"gradeMapping"`
	KnowledgePointIDs []string        `json:"knowledgePointIds"`
	AbilityPointIDs   []string        `json:"abilityPointIds"`
	SortOrder         int             `json:"sortOrder"`
}

type ReviewStepInput struct {
	Label       string  `json:"label"`
	Description *string `json:"description"`
	Enabled     bool    `json:"enabled"`
	SubjectType *string `json:"subjectType"`
	Weight      float64 `json:"weight"`
	SortOrder   int     `json:"sortOrder"`
}

func (h *TaskEvaluationHandler) ListMethods(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	taskID := chi.URLParam(r, "taskId")
	if taskID == "" {
		respondError(w, http.StatusBadRequest, "缺少任务ID")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	configs, err := h.Service.ListMethods(r.Context(), taskID, tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询测评方式失败")
		return
	}
	respondJSON(w, http.StatusOK, TaskEvaluationMethodListResponse{Methods: configs})
}

func (h *TaskEvaluationHandler) SaveMethods(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	taskID := chi.URLParam(r, "taskId")
	if taskID == "" {
		respondError(w, http.StatusBadRequest, "缺少任务ID")
		return
	}
	var req SaveTaskEvaluationMethodsRequest
	if !decodeBody(w, r, &req) {
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	taskTenantID, err := h.Service.TaskTenantID(r.Context(), taskID)
	if err != nil || taskTenantID != tenantID {
		respondError(w, http.StatusNotFound, "场景任务不存在")
		return
	}

	claims := middleware.CurrentUser(r)
	creatorID := ""
	if claims != nil {
		creatorID = claims.UserID
	}

	inputs := make([]*service.MethodSaveInput, 0, len(req.Methods))
	for _, m := range req.Methods {
		evalPoints := make([]service.EvalPointSaveInput, 0, len(m.EvalPoints))
		for _, ep := range m.EvalPoints {
			evalPoints = append(evalPoints, service.EvalPointSaveInput{
				Name:              ep.Name,
				Description:       ep.Description,
				SubType:           ep.SubType,
				Types:             coalesceStringSlice(ep.Types),
				Weight:            ep.Weight,
				ScoringMethod:     ep.ScoringMethod,
				GradeMapping:      ep.GradeMapping,
				KnowledgePointIDs: coalesceStringSlice(ep.KnowledgePointIDs),
				AbilityPointIDs:   coalesceStringSlice(ep.AbilityPointIDs),
				SortOrder:         ep.SortOrder,
			})
		}
		reviewSteps := make([]service.ReviewStepSaveInput, 0, len(m.ReviewSteps))
		for _, rs := range m.ReviewSteps {
			reviewSteps = append(reviewSteps, service.ReviewStepSaveInput{
				Label:       rs.Label,
				Description: rs.Description,
				Enabled:     rs.Enabled,
				SubjectType: rs.SubjectType,
				Weight:      rs.Weight,
				SortOrder:   rs.SortOrder,
			})
		}
		inputs = append(inputs, &service.MethodSaveInput{
			MethodKey:        m.MethodKey,
			Weight:           m.Weight,
			EvalObject:       m.EvalObject,
			ScoreType:        m.ScoreType,
			EvalSubjects:     m.EvalSubjects,
			RubricTemplateID: m.RubricTemplateID,
			ResourceConfig:   m.ResourceConfig,
			IsEnabled:        m.IsEnabled,
			EvalPoints:       evalPoints,
			ReviewSteps:      reviewSteps,
		})
	}

	configs, err := h.Service.SaveMethods(r.Context(), tenantID, taskID, creatorID, req.Version, inputs)
	if err != nil {
		if err == service.ErrMethodVersionConflict {
			respondError(w, http.StatusConflict, "评价规则已被其他会话修改")
			return
		}
		respondServerError(w, r, err, "保存测评方式失败")
		return
	}
	respondJSON(w, http.StatusOK, TaskEvaluationMethodListResponse{Methods: configs})
}

type RubricTemplateInput struct {
	Name        string         `json:"name"`
	Mode        string         `json:"mode"`
	Types       []string       `json:"types,omitempty"`
	Description *string        `json:"description,omitempty"`
	Data        domain.JSONMap `json:"data"`
}

func (h *TaskEvaluationHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	cfg := h.Service.Store().TaskEval().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListTemplates(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询评分模板失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.RubricTemplate]{Items: items, Total: total})
}

func (h *TaskEvaluationHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	t, err := h.Service.GetTemplate(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "评分模板不存在")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if t.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	respondJSON(w, http.StatusOK, t)
}

func (h *TaskEvaluationHandler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req RubricTemplateInput
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Mode == "" || req.Data == nil {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	t, err := h.Service.CreateTemplate(r.Context(), tenantID, &store.RubricTemplateParams{
		Name:        req.Name,
		Mode:        req.Mode,
		Types:       coalesceStringSlice(req.Types),
		Description: req.Description,
		Data:        req.Data,
	})
	if err != nil {
		respondServerError(w, r, err, "创建评分模板失败")
		return
	}
	respondJSON(w, http.StatusCreated, t)
}

func (h *TaskEvaluationHandler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	var req RubricTemplateInput
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Mode == "" || req.Data == nil {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	existing, err := h.Service.GetTemplate(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "评分模板不存在")
		return
	}
	if existing.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	t, err := h.Service.UpdateTemplate(r.Context(), id, &store.RubricTemplateParams{
		Name:        req.Name,
		Mode:        req.Mode,
		Types:       coalesceStringSlice(req.Types),
		Description: req.Description,
		Data:        req.Data,
	})
	if err != nil {
		respondServerError(w, r, err, "更新评分模板失败")
		return
	}
	respondJSON(w, http.StatusOK, t)
}

func (h *TaskEvaluationHandler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	existing, err := h.Service.GetTemplate(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "评分模板不存在")
		return
	}
	if existing.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	if err := h.Service.DeleteTemplate(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除评分模板失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
