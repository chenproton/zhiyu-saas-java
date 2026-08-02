package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ExamUsageHandler struct {
	Service *service.EvaluationService
}

type CreateExamUsageRequest struct {
	ExamID      string   `json:"examId"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	StartTime   *string  `json:"startTime"`
	EndTime     *string  `json:"endTime"`
	Duration    *int     `json:"duration"`
	TargetType  *string  `json:"targetType"`
	TargetIDs   []string `json:"targetIds"`
}

func (h *ExamUsageHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().ExamUsages().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListExamUsages(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询考试安排列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ExamUsage]{Items: items, Total: total})
}

func (h *ExamUsageHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.Service.GetExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, usage)
}

func (h *ExamUsageHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateExamUsageRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ExamID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	usage, err := h.Service.CreateExamUsage(r.Context(), &store.ExamUsageCreateParams{
		TenantID:    tenantID,
		ExamID:      req.ExamID,
		Name:        req.Name,
		Description: req.Description,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Duration:    req.Duration,
		TargetType:  req.TargetType,
		TargetIDs:   coalesceStringSlice(req.TargetIDs),
		CreatorID:   claims.UserID,
	})
	if err != nil {
		respondServerError(w, r, err, "创建考试安排失败")
		return
	}
	respondJSON(w, http.StatusCreated, usage)
}

func (h *ExamUsageHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.Service.GetExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}

	var req CreateExamUsageRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	usage, err = h.Service.UpdateExamUsage(r.Context(), id, &store.ExamUsageCreateParams{
		Name:        req.Name,
		Description: req.Description,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Duration:    req.Duration,
		TargetType:  req.TargetType,
		TargetIDs:   coalesceStringSlice(req.TargetIDs),
	})
	if err != nil {
		respondServerError(w, r, err, "更新考试安排失败")
		return
	}
	respondJSON(w, http.StatusOK, usage)
}

func (h *ExamUsageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.Service.GetExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}
	if err := h.Service.DeleteExamUsage(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除考试安排失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ExamUsageHandler) Start(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.Service.GetExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}
	if err := h.Service.SetExamUsageStatus(r.Context(), id, "in_progress"); err != nil {
		respondServerError(w, r, err, "开始考试安排失败")
		return
	}
	usage, _ = h.Service.GetExamUsage(r.Context(), id)
	respondJSON(w, http.StatusOK, usage)
}

func (h *ExamUsageHandler) Finish(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usage, err := h.Service.GetExamUsage(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}
	if err := h.Service.SetExamUsageStatus(r.Context(), id, "finished"); err != nil {
		respondServerError(w, r, err, "完成考试安排失败")
		return
	}
	usage, _ = h.Service.GetExamUsage(r.Context(), id)
	respondJSON(w, http.StatusOK, usage)
}
