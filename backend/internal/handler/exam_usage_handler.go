package handler

import (
	"context"
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

// ExamUsageRequest 考试安排创建/更新请求体（字段一致，更新流程忽略 examId）。
type ExamUsageRequest struct {
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

// crud 返回考试安排 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *ExamUsageHandler) crud() crudConfig[ExamUsageRequest, domain.ExamUsage] {
	return crudConfig[ExamUsageRequest, domain.ExamUsage]{
		NotFoundMsg:    "考试安排不存在",
		CreateErrMsg:   "创建考试安排失败",
		UpdateErrMsg:   "更新考试安排失败",
		DeleteErrMsg:   "删除考试安排失败",
		CheckOwnership: true,
		GetOwnership:   true,
		ValidateCreate: func(t *ExamUsageRequest) string {
			if t.ExamID == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *ExamUsageRequest) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *ExamUsageRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *ExamUsageRequest, tenantID, userID string) (string, error) {
			u, err := h.Service.CreateExamUsage(ctx, &store.ExamUsageCreateParams{
				TenantID:    tenantID,
				ExamID:      t.ExamID,
				Name:        t.Name,
				Description: t.Description,
				StartTime:   t.StartTime,
				EndTime:     t.EndTime,
				Duration:    t.Duration,
				TargetType:  t.TargetType,
				TargetIDs:   coalesceStringSlice(t.TargetIDs),
				CreatorID:   userID,
			})
			if err != nil {
				return "", err
			}
			return u.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, _ string, t *ExamUsageRequest) error {
			_, err := h.Service.UpdateExamUsage(ctx, id, &store.ExamUsageCreateParams{
				Name:        t.Name,
				Description: t.Description,
				StartTime:   t.StartTime,
				EndTime:     t.EndTime,
				Duration:    t.Duration,
				TargetType:  t.TargetType,
				TargetIDs:   coalesceStringSlice(t.TargetIDs),
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, _ string) error {
			return h.Service.DeleteExamUsage(ctx, id)
		},
		GetByIDFn: func(ctx context.Context, id, _ string) (domain.ExamUsage, error) {
			u, err := h.Service.GetExamUsage(ctx, id)
			if err != nil {
				return domain.ExamUsage{}, err
			}
			return *u, nil
		},
		TenantIDFn: func(t *domain.ExamUsage) string { return t.TenantID },
	}
}

func (h *ExamUsageHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *ExamUsageHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *ExamUsageHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *ExamUsageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
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
	if usage.Status != "scheduled" {
		respondError(w, http.StatusBadRequest, "考试安排不在待开始状态")
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
	if usage.Status != "in_progress" {
		respondError(w, http.StatusBadRequest, "考试安排不在进行中状态")
		return
	}
	if err := h.Service.SetExamUsageStatus(r.Context(), id, "finished"); err != nil {
		respondServerError(w, r, err, "完成考试安排失败")
		return
	}
	usage, _ = h.Service.GetExamUsage(r.Context(), id)
	respondJSON(w, http.StatusOK, usage)
}
