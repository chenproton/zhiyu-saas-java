package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type EvaluationResultHandler struct {
	Service *service.EvaluationService
}

type SubmitResultRequest struct {
	TaskID            string          `json:"taskId"`
	NodeID            string          `json:"nodeId"`
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
	// ExpectedVersion 页面加载时的资源版本提示（文档 13.B2）：服务端校验快照存在则采纳，否则回退最新。
	ExpectedVersion string `json:"expectedVersion,omitempty"`
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

	cfg := h.Service.Store().EvaluationResults().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	// 学生仅可查看本人的评价结果，忽略其余过滤参数
	if middleware.HasRole(claims, domain.RoleStudent) {
		params.Values["evaluateeId"] = claims.UserID
		params.Values["ownOnly"] = "true"
	}
	items, total, err := h.Service.ListEvaluationResults(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询评价结果失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.SceneEvaluationResult]{Items: items, Total: total})
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
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "评价结果不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if res.TenantID == nil || claims.TenantID == nil || *res.TenantID != *claims.TenantID {
		// 租户缺失行（基线表该列可空）一律视为不可见，防止跨租户读取/评分
		respondError(w, http.StatusNotFound, "评价结果不存在")
		return
	}
	// 学生仅可查看本人的评价结果
	if middleware.HasRole(claims, domain.RoleStudent) && res.EvaluateeID != claims.UserID {
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
	if middleware.HasRole(claims, domain.RoleStudent) && req.EvaluateeID != claims.UserID {
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

	evaluatorType := ""
	if req.EvaluatorType != nil {
		evaluatorType = *req.EvaluatorType
	}
	// 评价人未指定时存 NULL（uuid 列不允许空串）
	var evaluatorID *string
	if req.EvaluatorID != nil && *req.EvaluatorID != "" {
		evaluatorID = req.EvaluatorID
	}
	// sceneId 为空串时同样存 NULL；落库值最终以 store 层 task_id 反查为准（文档 13.A6，客户端传值仅作兼容透传）
	var sceneID *string
	if req.SceneID != nil && *req.SceneID != "" {
		sceneID = req.SceneID
	}

	// 学生提交时评价人只能是本人；指定评价人必须属于当前租户
	if middleware.HasRole(claims, domain.RoleStudent) && evaluatorID != nil && *evaluatorID != claims.UserID {
		respondError(w, http.StatusForbidden, "学生仅可提交本人为评价人的评价结果")
		return
	}
	if evaluatorID != nil {
		evaluator, err := h.Service.Store().Users().Get(r.Context(), tenantID, *evaluatorID)
		if err != nil || evaluator.TenantID == nil || *evaluator.TenantID != tenantID {
			respondError(w, http.StatusForbidden, "无权操作：评价人不属于您的租户")
			return
		}
	}

	res, err := h.Service.SubmitEvaluationResult(r.Context(), &store.EvaluationResultSubmitParams{
		TenantID:          tenantID,
		TaskID:            req.TaskID,
		SceneID:           sceneID,
		ExpectedVersion:   req.ExpectedVersion,
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
		if errors.Is(err, store.ErrAlreadyGraded) {
			respondError(w, http.StatusConflict, "评价结果已被评分，无法重新提交")
			return
		}
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
	if middleware.HasRole(claims, domain.RoleStudent) {
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
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "评价结果不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if res.TenantID == nil || claims.TenantID == nil || *res.TenantID != *claims.TenantID {
		// 租户缺失行（基线表该列可空）一律视为不可见，防止跨租户读取/评分
		respondError(w, http.StatusNotFound, "评价结果不存在")
		return
	}
	err = h.Service.GradeEvaluationResult(r.Context(), *res.TenantID, id, claims.UserID, &store.EvaluationResultGradeParams{
		Score:             req.Score,
		Comment:           req.Comment,
		EvalPointScores:   jsonRawMessageToJSONMap(req.EvalPointScores),
		DrawnQuestions:    jsonRawMessageToJSONMap(req.DrawnQuestions),
		SubjectiveContent: jsonRawMessageToJSONMap(req.SubjectiveContent),
	}, res.TaskID, res.MethodKey, res.EvaluateeID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusConflict, "评价结果已评分或不存在，请刷新后重试")
			return
		}
		respondServerError(w, r, err, "评分失败")
		return
	}
	res, err = h.Service.GetEvaluationResult(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "评分成功但查询结果失败")
		return
	}
	respondJSON(w, http.StatusOK, res)
}

func (h *EvaluationResultHandler) BatchGrade(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if middleware.HasRole(claims, domain.RoleStudent) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req BatchGradeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Items) == 0 {
		respondError(w, http.StatusBadRequest, "缺少评分项")
		return
	}

	// 批量查一次（替代逐条 GetEvaluationResult 的 N+1），租户限定在查询内
	ids := make([]string, 0, len(req.Items))
	for _, item := range req.Items {
		ids = append(ids, item.ID)
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if params.Values == nil {
		params.Values = map[string]string{}
	}
	params.Values["ids"] = strings.Join(ids, ",")
	params.Limit = len(ids)
	results, _, err := h.Service.ListEvaluationResults(r.Context(), params, h.Service.Store().EvaluationResults().ListConfig())
	if err != nil {
		respondServerError(w, r, err, "查询失败")
		return
	}
	byID := make(map[string]domain.SceneEvaluationResult, len(results))
	for _, res := range results {
		byID[res.ID] = res
	}
	items := make([]store.EvaluationResultGradeItem, 0, len(req.Items))
	for _, item := range req.Items {
		if _, ok := byID[item.ID]; !ok {
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

	err = h.Service.BatchGradeEvaluationResults(r.Context(), *claims.TenantID, claims.UserID, items)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusConflict, "存在已评分或不存在的结果，请刷新后重试")
			return
		}
		respondServerError(w, r, err, "批量评分失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]int{"count": len(items)})
}
