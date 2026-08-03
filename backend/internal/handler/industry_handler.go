package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type IndustryHandler struct {
	Store *store.IndustriesStore
}

// IndustryRequest 行业创建/更新请求体（更新流程忽略 tenantId）。
type IndustryRequest struct {
	TenantID  string  `json:"tenantId"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	ParentID  *string `json:"parentId"`
	Enabled   bool    `json:"enabled"`
	SortOrder int     `json:"sortOrder"`
}

func (h *IndustryHandler) List(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.Industry](r.Context(), h.Store.Q(), r, h.Store.ListConfig())
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询行业列表失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.Industry]{Items: items, Total: total})
}

// crud 返回行业 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *IndustryHandler) crud() crudConfig[IndustryRequest, domain.Industry] {
	return crudConfig[IndustryRequest, domain.Industry]{
		NotFoundMsg:        "行业不存在",
		CreateErrMsg:       "创建行业失败",
		UpdateErrMsg:       "更新行业失败",
		DeleteErrMsg:       "删除行业失败",
		DeleteCheckErrMsg:  "检查子行业失败",
		Permit:             func(r *http.Request) bool { return canManagePortal(middleware.CurrentUser(r)) },
		UniqueViolationMsg: "行业代码已存在，请使用其他代码",
		CheckOwnership:     true,
		GetOwnership:       true,
		ValidateCreate: func(t *IndustryRequest) string {
			if t.TenantID == "" || t.Code == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *IndustryRequest) (string, bool) {
			return t.TenantID, verifyRequestTenant(w, r, t.TenantID)
		},
		ValidateUpdate: func(t *IndustryRequest) string {
			if t.Code == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *IndustryRequest, tenantID, userID string) (string, error) {
			return h.Store.Create(ctx, store.IndustryCreateParams{
				TenantID:  tenantID,
				Code:      t.Code,
				Name:      t.Name,
				ParentID:  t.ParentID,
				Enabled:   t.Enabled,
				SortOrder: t.SortOrder,
			})
		},
		UpdateFn: func(ctx context.Context, id, _ string, t *IndustryRequest) error {
			return h.Store.Update(ctx, id, store.IndustryUpdateParams{
				Code:      t.Code,
				Name:      t.Name,
				ParentID:  t.ParentID,
				Enabled:   t.Enabled,
				SortOrder: t.SortOrder,
			})
		},
		DeleteFn: func(ctx context.Context, id, _ string) error {
			return h.Store.Delete(ctx, id)
		},
		GetByIDFn: func(ctx context.Context, id, _ string) (domain.Industry, error) {
			return h.Store.GetByID(ctx, id)
		},
		TenantIDFn: func(t *domain.Industry) string { return t.TenantID },
		DeleteChecks: []func(ctx context.Context, t *domain.Industry) (string, error){
			func(ctx context.Context, t *domain.Industry) (string, error) {
				count, err := h.Store.CountChildren(ctx, t.ID)
				if err != nil {
					return "", err
				}
				if count > 0 {
					return "该行业下仍有子行业，请先删除子行业", nil
				}
				return "", nil
			},
		},
	}
}

func (h *IndustryHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *IndustryHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *IndustryHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *IndustryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
