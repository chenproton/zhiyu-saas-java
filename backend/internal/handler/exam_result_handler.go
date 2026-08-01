package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ExamResultHandler struct {
	Service *service.EvaluationService
}

type ExamResultListResponse struct {
	Items []domain.ExamResult `json:"items"`
	Total int                 `json:"total"`
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

	cfg := store.ListQueryConfig[domain.ExamResult]{
		Table:         "exam_results er LEFT JOIN majors m ON m.id = er.major_id",
		SelectColumns: "er.id, er.exam_usage_id, er.user_id, er.student_name, er.class_name, er.grade, er.major_id, COALESCE(m.name, '') AS major_name, er.score, er.total_score, er.is_pass, er.answers, er.submit_time, er.created_at",
		TenantScoped:  true,
		TenantColumn:  "er.tenant_id",
		OrderBy:       "er.score DESC, er.submit_time ASC",
		ScanRows:      store.ScanExamResultRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			qb.AddCondition("er.exam_usage_id = " + qb.NextArg(usageID))
		},
	}
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
	respondJSON(w, http.StatusOK, ExamResultListResponse{Items: items, Total: total})
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

	result, err := h.Service.SubmitExamResult(r.Context(), tenantID, claims.UserID, req.ExamUsageID, req.Answers, req.MethodKey)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondError(w, http.StatusNotFound, "考试安排不存在")
			return
		}
		respondError(w, http.StatusInternalServerError, "提交考试结果失败")
		return
	}
	respondJSON(w, http.StatusCreated, result)
}
