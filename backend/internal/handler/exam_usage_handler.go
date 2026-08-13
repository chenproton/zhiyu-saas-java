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
	ExamID         string   `json:"examId"`
	Name           string   `json:"name"`
	Description    *string  `json:"description"`
	StartTime      *string  `json:"startTime"`
	EndTime        *string  `json:"endTime"`
	Duration       *int     `json:"duration"`
	TargetType     *string  `json:"targetType"`
	TargetIDs      []string `json:"targetIds"`
	ActivationMode string   `json:"activationMode"`
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
		// Update/Delete 的 store SQL 按 tenant_id 过滤（uuid 列），必须解析租户，
		// 否则 tenantID 为空串导致 "invalid input syntax for type uuid" 500。
		TenantFn: requireTenant,
		ValidateUpdate: func(t *ExamUsageRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		ValidateUpdateExisting: func(t *ExamUsageRequest, existing *domain.ExamUsage) string {
			// 部分更新兜底：activationMode 未携带时回退已有值（防覆盖为空串导致启停失效）
			if t.ActivationMode == "" {
				t.ActivationMode = existing.ActivationMode
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *ExamUsageRequest, tenantID, userID string) (string, error) {
			// 初始状态按启用条件：随时作答 → 已发布；定时/手动启停 → 草稿
			status := "draft"
			if t.ActivationMode == "always" {
				status = "published"
			}
			u, err := h.Service.CreateExamUsage(ctx, &store.ExamUsageCreateParams{
				TenantID:       tenantID,
				ExamID:         t.ExamID,
				Name:           t.Name,
				Description:    t.Description,
				StartTime:      t.StartTime,
				EndTime:        t.EndTime,
				Duration:       t.Duration,
				TargetType:     t.TargetType,
				TargetIDs:      coalesceStringSlice(t.TargetIDs),
				Status:         status,
				ActivationMode: t.ActivationMode,
				CreatorID:      userID,
			})
			if err != nil {
				return "", err
			}
			return u.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *ExamUsageRequest) error {
			_, err := h.Service.UpdateExamUsage(ctx, tenantID, id, &store.ExamUsageCreateParams{
				Name:           t.Name,
				Description:    t.Description,
				StartTime:      t.StartTime,
				EndTime:        t.EndTime,
				Duration:       t.Duration,
				TargetType:     t.TargetType,
				TargetIDs:      t.TargetIDs,
				ActivationMode: t.ActivationMode,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Service.DeleteExamUsage(ctx, tenantID, id)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.ExamUsage, error) {
			u, err := h.Service.GetExamUsage(ctx, tenantID, id)
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
	if !h.manualOnly(w, r) {
		return
	}
	crudUpdate(w, r, h.crud())
}

func (h *ExamUsageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !h.manualOnly(w, r) {
		return
	}
	crudDelete(w, r, h.crud())
}

// manualOnly 仅允许操作手动创建的考试安排；自动创建（task/node/course）不允许编辑/删除。
func (h *ExamUsageHandler) manualOnly(w http.ResponseWriter, r *http.Request) bool {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return false
	}
	usage, err := h.Service.GetExamUsage(r.Context(), tenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return false
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return false
	}
	// TargetType 为 NULL（异常/旧数据）视同非手动类型，禁止编辑/删除
	if usage.TargetType == nil || !isManualTargetType(*usage.TargetType) {
		respondError(w, http.StatusForbidden, "自动创建的考试安排不允许编辑/删除")
		return false
	}
	return true
}

// isManualTargetType 手动创建的考试安排目标类型。
func isManualTargetType(t string) bool {
	switch t {
	case "class", "major", "department", "public":
		return true
	}
	return false
}

// Finish 停止考试：已发布/进行中 -> 已结束（不可作答）。
func (h *ExamUsageHandler) Finish(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	usage, err := h.Service.GetExamUsage(r.Context(), tenantID, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}
	if usage.Status != "published" && usage.Status != "in_progress" {
		respondError(w, http.StatusBadRequest, "考试安排不在已发布状态")
		return
	}
	if err := h.Service.SetExamUsageStatus(r.Context(), id, "finished"); err != nil {
		respondServerError(w, r, err, "停止考试安排失败")
		return
	}
	usage, err = h.Service.GetExamUsage(r.Context(), tenantID, id)
	if err != nil {
		respondServerError(w, r, err, "查询考试安排失败")
		return
	}
	respondJSON(w, http.StatusOK, usage)
}

// Publish 开启考试安排：草稿 -> 已发布（学生可作答）。
func (h *ExamUsageHandler) Publish(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	usage, err := h.Service.GetExamUsage(r.Context(), tenantID, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "考试安排不存在")
		return
	}
	if !verifyTenantOwnership(w, r, usage.TenantID) {
		return
	}
	if usage.Status != "draft" && usage.Status != "pending" {
		respondError(w, http.StatusBadRequest, "考试安排不在草稿状态")
		return
	}
	if err := h.Service.SetExamUsageStatus(r.Context(), id, "published"); err != nil {
		respondServerError(w, r, err, "开启考试安排失败")
		return
	}
	usage, err = h.Service.GetExamUsage(r.Context(), tenantID, id)
	if err != nil {
		respondServerError(w, r, err, "查询考试安排失败")
		return
	}
	respondJSON(w, http.StatusOK, usage)
}

// ExamCenter 考试中心列表（全部考试 + 可参加标记）。
func (h *ExamUsageHandler) ExamCenter(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	isStudent := false
	for _, c := range claims.RoleCodes {
		if c == domain.RoleStudent {
			isStudent = true
			break
		}
	}
	items, err := h.Service.ListExamCenter(r.Context(), *claims.TenantID, claims.UserID, isStudent)
	if err != nil {
		respondServerError(w, r, err, "查询考试中心失败")
		return
	}
	respondJSON(w, http.StatusOK, items)
}
