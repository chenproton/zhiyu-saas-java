package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AffairsTermHandler struct {
	Service *service.AffairsPlanService
}

type TermRequest struct {
	Name       string `json:"name"`
	StartDate  string `json:"startDate"`
	EndDate    string `json:"endDate"`
	WeeksCount int    `json:"weeksCount"`
	IsCurrent  *bool  `json:"isCurrent"`
}

func (h *AffairsTermHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().Terms().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListTerms(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询学期列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.Term]{Items: items, Total: total})
}

// crud 返回学期 CRUD 差异配置；HTTP 流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
// Term 无 TenantID 字段，租户隔离通过 GetByIDFn 的租户限定查询实现（TenantFn=requireTenant）。
func (h *AffairsTermHandler) crud() crudConfig[TermRequest, domain.Term] {
	return crudConfig[TermRequest, domain.Term]{
		NotFoundMsg:        "学期不存在",
		CreateErrMsg:       "创建学期失败",
		UpdateErrMsg:       "更新学期失败",
		DeleteErrMsg:       "删除学期失败",
		UniqueViolationMsg: "学期已存在",
		ValidateCreate: func(t *TermRequest) string {
			if t.Name == "" || t.StartDate == "" || t.EndDate == "" {
				return "缺少必填字段"
			}
			if t.WeeksCount <= 0 {
				t.WeeksCount = 16
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *TermRequest) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *TermRequest) string {
			if t.Name == "" || t.StartDate == "" || t.EndDate == "" {
				return "缺少必填字段"
			}
			if t.WeeksCount <= 0 {
				t.WeeksCount = 16
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *TermRequest, tenantID, userID string) (string, error) {
			isCurrent := false
			if t.IsCurrent != nil {
				isCurrent = *t.IsCurrent
			}
			return h.Service.CreateTerm(ctx, tenantID, &store.TermParams{
				Name: t.Name, StartDate: t.StartDate, EndDate: t.EndDate,
				WeeksCount: t.WeeksCount, IsCurrent: isCurrent,
			})
		},
		ValidateUpdateExisting: func(t *TermRequest, existing *domain.Term) string {
			// 部分更新兜底：isCurrent 未携带时保留已有状态（防更新其他字段误清"当前学期"标记）
			if t.IsCurrent == nil {
				v := existing.IsCurrent
				t.IsCurrent = &v
			}
			return ""
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *TermRequest) error {
			return h.Service.UpdateTerm(ctx, tenantID, id, &store.TermParams{
				Name: t.Name, StartDate: t.StartDate, EndDate: t.EndDate,
				WeeksCount: t.WeeksCount, IsCurrent: *t.IsCurrent,
			})
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Service.DeleteTerm(ctx, id, tenantID)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.Term, error) {
			term, err := h.Service.GetTerm(ctx, id, tenantID)
			if err != nil {
				return domain.Term{}, err
			}
			return *term, nil
		},
		TenantFn: requireTenant,
		DeleteChecks: []func(ctx context.Context, t *domain.Term) (string, error){
			func(ctx context.Context, t *domain.Term) (string, error) {
				count, err := h.Service.Store().Terms().CountRefs(ctx, t.ID)
				if err != nil {
					return "", err
				}
				if count > 0 {
					return "该学期已被教学计划或排课引用，无法删除", nil
				}
				return "", nil
			},
		},
	}
}

func (h *AffairsTermHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *AffairsTermHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *AffairsTermHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
