package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type ExamResultHandler struct {
	Service *service.EvaluationService
}

type SubmitExamResultRequest struct {
	ExamUsageID string                 `json:"examUsageId"`
	Answers     map[string]interface{} `json:"answers"`
	MethodKey   string                 `json:"methodKey"`
}

func (h *ExamResultHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	usageID := r.URL.Query().Get("usageId")
	if usageID == "" {
		respondError(w, http.StatusBadRequest, "缺少使用记录ID")
		return
	}

	cfg := h.Service.Store().ExamResults().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListExamResults(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询考试结果失败")
		return
	}
	for i := range items {
		items[i].Score = service.RoundScore(items[i].Score)
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ExamResult]{Items: items, Total: total})
}

func (h *ExamResultHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req SubmitExamResultRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ExamUsageID == "" {
		respondError(w, http.StatusBadRequest, "缺少考试使用记录ID")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	usage, err := h.Service.Store().ExamUsages().Get(r.Context(), req.ExamUsageID)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if usage.TenantID != tenantID {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}

	result, err := h.Service.SubmitExamResult(r.Context(), tenantID, claims.UserID, req.ExamUsageID, req.Answers, req.MethodKey)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondError(w, http.StatusNotFound, "考试安排不存在")
			return
		}
		respondServerError(w, r, err, "提交考试结果失败")
		return
	}
	respondJSON(w, http.StatusCreated, result)
}
