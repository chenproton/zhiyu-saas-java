package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
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
	// 学生仅可查看本人考试结果
	if middleware.HasRole(claims, domain.RoleStudent) {
		if params.Values == nil {
			params.Values = map[string]string{}
		}
		params.Values["userId"] = claims.UserID
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

	usage, err := h.Service.Store().ExamUsages().Get(r.Context(), tenantID, req.ExamUsageID)
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
		if errors.Is(err, store.ErrAlreadyGraded) {
			respondError(w, http.StatusConflict, "该测评已完成评分，无法重新提交")
			return
		}
		if errors.Is(err, store.ErrForbidden) {
			respondError(w, http.StatusForbidden, "该考试仅限指定班级参加")
			return
		}
		if errors.Is(err, store.ErrExamNotStarted) {
			respondError(w, http.StatusConflict, "考试尚未开始")
			return
		}
		if errors.Is(err, store.ErrExamEnded) {
			respondError(w, http.StatusConflict, "考试已结束")
			return
		}
		if errors.Is(err, store.ErrRetakeNotAllowed) {
			respondError(w, http.StatusConflict, "该考试不允许重复作答")
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "考试安排不存在")
			return
		}
		respondServerError(w, r, err, "提交考试结果失败")
		return
	}
	respondJSON(w, http.StatusCreated, result)
}

// Get 查询单个考试结果（评分详情页）。
func (h *ExamResultHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	result, err := h.Service.Store().ExamResults().Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "考试结果不存在")
			return
		}
		respondServerError(w, r, err, "查询考试结果失败")
		return
	}
	// 租户校验不可在任一缺失时跳过：无租户 token 一律拒绝，防止越权读取他租户成绩
	if claims.TenantID == nil || result.TenantID == nil || *result.TenantID != *claims.TenantID {
		respondError(w, http.StatusNotFound, "考试结果不存在")
		return
	}
	// 学生仅可查看本人考试结果
	if middleware.HasRole(claims, domain.RoleStudent) && result.UserID != claims.UserID {
		respondError(w, http.StatusNotFound, "考试结果不存在")
		return
	}
	respondJSON(w, http.StatusOK, result)
}

// Grade 教师评分日常考试结果。
func (h *ExamResultHandler) Grade(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req GradeExamResultRequest
	if !decodeBody(w, r, &req) {
		return
	}
	id := chi.URLParam(r, "id")
	// 评分前先校验结果归属租户，防止先写入后校验（跨租户改分）
	existing, err := h.Service.Store().ExamResults().Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试结果不存在")
		return
	}
	if existing.TenantID == nil {
		// 租户缺失行（基线表该列可空）一律视为不可见，防止跨租户改分
		respondError(w, http.StatusNotFound, "考试结果不存在")
		return
	}
	if !verifyTenantOwnership(w, r, *existing.TenantID) {
		return
	}
	result, err := h.Service.GradeExamResult(r.Context(), *existing.TenantID, id, claims.UserID, req.Scores, req.Comment)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "考试结果不存在")
			return
		}
		if errors.Is(err, store.ErrForbidden) {
			respondError(w, http.StatusForbidden, "该考试安排不支持评分")
			return
		}
		respondServerError(w, r, err, "保存评分失败")
		return
	}
	respondJSON(w, http.StatusOK, result)
}

// GradeExamResultRequest 评分请求体。
type GradeExamResultRequest struct {
	Scores  map[string]interface{} `json:"scores"`
	Comment *string                `json:"comment"`
}
