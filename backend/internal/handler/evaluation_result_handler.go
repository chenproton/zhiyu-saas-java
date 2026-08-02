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

type EvaluationResultHandler struct {
	Service *service.EvaluationService
}

type EvaluationResultListResponse struct {
	Items []domain.SceneEvaluationResult `json:"items"`
	Total int                            `json:"total"`
}

type SubmitResultRequest struct {
	TaskID            string          `json:"taskId"`
	SceneID           *string         `json:"sceneId,omitempty"`
	MethodKey         string          `json:"methodKey"`
	EvaluateeID       string          `json:"evaluateeId"`
	EvaluatorID       *string         `json:"evaluatorId,omitempty"`
	EvaluatorType     *string         `json:"evaluatorType,omitempty"`
	MaxScore          float64         `json:"maxScore"`
	ObjectiveAnswers  json.RawMessage `json:"objectiveAnswers,omitempty"`
	SubjectiveContent json.RawMessage `json:"subjectiveContent,omitempty"`
	DrawnQuestions    json.RawMessage `json:"drawnQuestions,omitempty"`
	EvalPointScores   json.RawMessage `json:"evalPointScores,omitempty"`
}

type GradeResultRequest struct {
	Score             float64         `json:"score"`
	Comment           *string         `json:"comment"`
	EvalPointScores   json.RawMessage `json:"evalPointScores,omitempty"`
	DrawnQuestions    json.RawMessage `json:"drawnQuestions,omitempty"`
	SubjectiveContent json.RawMessage `json:"subjectiveContent,omitempty"`
}

type BatchGradeItem struct {
	ID              string          `json:"id"`
	Score           float64         `json:"score"`
	Comment         *string         `json:"comment"`
	EvalPointScores json.RawMessage `json:"evalPointScores,omitempty"`
}

type BatchGradeRequest struct {
	Items []BatchGradeItem `json:"items"`
}

func (h *EvaluationResultHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := store.ListQueryConfig[domain.SceneEvaluationResult]{
		Table:         "scene_evaluation_results",
		SelectColumns: "id, task_id, scene_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status, total_score, max_score, eval_point_scores, objective_answers, subjective_content, drawn_questions, comment, graded_at, graded_by",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		ScanRows:      store.ScanSceneEvaluationResultRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if middleware.HasRole(claims, "student") {
				qb.AddCondition("evaluatee_id = " + qb.NextArg(claims.UserID))
				return
			}
			if taskID := p.Values["taskId"]; taskID != "" {
				qb.AddCondition("task_id = " + qb.NextArg(taskID))
			}
			if sceneID := p.Values["sceneId"]; sceneID != "" {
				qb.AddCondition("scene_id = " + qb.NextArg(sceneID))
			}
			if methodKey := p.Values["methodKey"]; methodKey != "" {
				qb.AddCondition("method_key = " + qb.NextArg(methodKey))
			}
			if evaluateeID := p.Values["evaluateeId"]; evaluateeID != "" {
				qb.AddCondition("evaluatee_id = " + qb.NextArg(evaluateeID))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListEvaluationResults(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询评价结果失败")
		return
	}
	respondJSON(w, http.StatusOK, EvaluationResultListResponse{Items: items, Total: total})
}

func (h *EvaluationResultHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	res, err := h.Service.GetEvaluationResult(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "评价结果不存在")
		return
	}
	if res.TenantID != nil && (claims.TenantID == nil || *res.TenantID != *claims.TenantID) {
		respondError(w, http.StatusNotFound, "评价结果不存在")
		return
	}
	// 学生仅可查看本人的评价结果
	if middleware.HasRole(claims, "student") && res.EvaluateeID != claims.UserID {
		respondError(w, http.StatusNotFound, "评价结果不存在")
		return
	}
	respondJSON(w, http.StatusOK, res)
}

func (h *EvaluationResultHandler) Submit(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req SubmitResultRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TaskID == "" || req.MethodKey == "" || req.EvaluateeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段（taskId、methodKey、evaluateeId）")
		return
	}
	// 学生仅可提交本人的评价结果，防止替他人提交/伪造成绩
	if middleware.HasRole(claims, "student") && req.EvaluateeID != claims.UserID {
		respondError(w, http.StatusForbidden, "仅可提交本人的评价结果")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if req.MaxScore == 0 {
		req.MaxScore = 100
	}

	evaluatorID := ""
	evaluatorType := ""
	if req.EvaluatorID != nil {
		evaluatorID = *req.EvaluatorID
	}
	if req.EvaluatorType != nil {
		evaluatorType = *req.EvaluatorType
	}

	res, err := h.Service.SubmitEvaluationResult(r.Context(), &store.EvaluationResultSubmitParams{
		TenantID:          tenantID,
		TaskID:            req.TaskID,
		SceneID:           req.SceneID,
		MethodKey:         req.MethodKey,
		EvaluateeID:       req.EvaluateeID,
		EvaluatorID:       evaluatorID,
		EvaluatorType:     evaluatorType,
		MaxScore:          req.MaxScore,
		EvalPointScores:   jsonRawMessageToJSONMap(req.EvalPointScores),
		ObjectiveAnswers:  jsonRawMessageToJSONMap(req.ObjectiveAnswers),
		SubjectiveContent: jsonRawMessageToJSONMap(req.SubjectiveContent),
		DrawnQuestions:    jsonRawMessageToJSONMap(req.DrawnQuestions),
	})
	if err != nil {
		respondServerError(w, r, err, "提交评价结果失败")
		return
	}
	respondJSON(w, http.StatusCreated, res)
}

func (h *EvaluationResultHandler) Grade(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	var req GradeResultRequest
	if !decodeBody(w, r, &req) {
		return
	}
	res, err := h.Service.GetEvaluationResult(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "评价结果不存在")
		return
	}
	if res.TenantID != nil && (claims.TenantID == nil || *res.TenantID != *claims.TenantID) {
		respondError(w, http.StatusNotFound, "评价结果不存在")
		return
	}
	err = h.Service.GradeEvaluationResult(r.Context(), id, claims.UserID, &store.EvaluationResultGradeParams{
		Score:             req.Score,
		Comment:           req.Comment,
		EvalPointScores:   jsonRawMessageToJSONMap(req.EvalPointScores),
		DrawnQuestions:    jsonRawMessageToJSONMap(req.DrawnQuestions),
		SubjectiveContent: jsonRawMessageToJSONMap(req.SubjectiveContent),
	}, res.TaskID, res.MethodKey, res.EvaluateeID)
	if err != nil {
		respondServerError(w, r, err, "评分失败")
		return
	}
	res, _ = h.Service.GetEvaluationResult(r.Context(), id)
	respondJSON(w, http.StatusOK, res)
}

func (h *EvaluationResultHandler) BatchGrade(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req BatchGradeRequest
	if !decodeBody(w, r, &req) {
		return
	}

	items := make([]store.EvaluationResultGradeItem, 0, len(req.Items))
	for _, item := range req.Items {
		res, err := h.Service.GetEvaluationResult(r.Context(), item.ID)
		if err != nil {
			respondError(w, http.StatusNotFound, "评价结果不存在")
			return
		}
		if res.TenantID != nil && (claims.TenantID == nil || *res.TenantID != *claims.TenantID) {
			respondError(w, http.StatusNotFound, "评价结果不存在")
			return
		}
		items = append(items, store.EvaluationResultGradeItem{
			ID:              item.ID,
			Score:           item.Score,
			Comment:         item.Comment,
			EvalPointScores: jsonRawMessageToJSONMap(item.EvalPointScores),
		})
	}

	_, err := h.Service.BatchGradeEvaluationResults(r.Context(), claims.UserID, items)
	if err != nil {
		respondServerError(w, r, err, "批量评分失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]int{"count": len(items)})
}
