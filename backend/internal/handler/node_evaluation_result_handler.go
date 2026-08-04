package handler

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type NodeEvaluationResultHandler struct {
	Service *service.NodeEvaluationResultService
}

func (h *NodeEvaluationResultHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	nodeID := r.URL.Query().Get("nodeId")
	if nodeID == "" {
		respondError(w, http.StatusBadRequest, "缺少节点ID")
		return
	}

	cfg := h.Service.Store().NodeEvaluationResults().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if middleware.HasRole(claims, domain.RoleStudent) {
		params.Values["isStudent"] = "true"
		params.Values["studentUserId"] = claims.UserID
	}
	items, total, err := h.Service.List(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询节点测评结果失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": total})
}

func (h *NodeEvaluationResultHandler) Submit(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req SubmitResultRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.NodeID == "" || req.MethodKey == "" || req.EvaluateeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段（nodeId、methodKey、evaluateeId）")
		return
	}
	// 学生仅可提交本人的节点测评结果，防止替他人提交/伪造成绩
	if middleware.HasRole(claims, domain.RoleStudent) && req.EvaluateeID != claims.UserID {
		respondError(w, http.StatusForbidden, "仅可提交本人的节点测评结果")
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

	// 学生提交时评价人只能是本人；指定评价人必须属于当前租户
	if middleware.HasRole(claims, domain.RoleStudent) && evaluatorID != nil && *evaluatorID != claims.UserID {
		respondError(w, http.StatusForbidden, "学生仅可提交本人为评价人的评价结果")
		return
	}
	if evaluatorID != nil {
		evaluator, err := h.Service.Store().Users().Get(r.Context(), *evaluatorID)
		if err != nil || evaluator.TenantID == nil || *evaluator.TenantID != tenantID {
			respondError(w, http.StatusForbidden, "无权操作：评价人不属于您的租户")
			return
		}
	}

	res, err := h.Service.SubmitNodeEvaluationResult(r.Context(), &store.NodeEvaluationResultSubmitParams{
		TenantID:          tenantID,
		NodeID:            req.NodeID,
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
		respondServerError(w, r, err, "提交节点测评结果失败")
		return
	}
	respondJSON(w, http.StatusCreated, res)
}
