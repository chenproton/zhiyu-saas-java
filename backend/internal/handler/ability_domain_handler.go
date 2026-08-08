package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AbilityDomainHandler struct {
	Service *service.PositionService
}

// AbilityDomainRequest 能力域创建/更新请求体（字段一致）。
type AbilityDomainRequest struct {
	CareerPositionID string   `json:"careerPositionId"`
	Name             string   `json:"name"`
	Description      *string  `json:"description"`
	BindingIDs       []string `json:"bindingIds"`
	SortOrder        int      `json:"sortOrder"`
}

func (h *AbilityDomainHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().AbilityDomains().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListAbilityDomains(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询能力域失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AbilityDomain]{Items: items, Total: total})
}

// crud 返回能力域 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *AbilityDomainHandler) crud() crudConfig[AbilityDomainRequest, domain.AbilityDomain] {
	return crudConfig[AbilityDomainRequest, domain.AbilityDomain]{
		NotFoundMsg:    "能力域不存在",
		CreateErrMsg:   "创建能力域失败",
		UpdateErrMsg:   "更新能力域失败",
		DeleteErrMsg:   "删除能力域失败",
		CheckOwnership: true,
		GetOwnership:   true,
		TenantFn: func(w http.ResponseWriter, r *http.Request) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateCreate: func(t *AbilityDomainRequest) string {
			if t.CareerPositionID == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *AbilityDomainRequest) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *AbilityDomainRequest) string {
			if t.CareerPositionID == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *AbilityDomainRequest, tenantID, userID string) (string, error) {
			if t.CareerPositionID != "" {
				pos, err := h.Service.Get(ctx, t.CareerPositionID)
				if err != nil || pos.TenantID != tenantID {
					return "", store.ErrNotFound
				}
			}
			d, err := h.Service.CreateAbilityDomain(ctx, tenantID, &store.AbilityDomainParams{
				CareerPositionID: t.CareerPositionID,
				Name:             t.Name,
				Description:      t.Description,
				BindingIDs:       coalesceStringSlice(t.BindingIDs),
				SortOrder:        t.SortOrder,
			})
			if err != nil {
				return "", err
			}
			return d.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *AbilityDomainRequest) error {
			if t.CareerPositionID != "" {
				pos, err := h.Service.Get(ctx, t.CareerPositionID)
				if err != nil || pos.TenantID != tenantID {
					return store.ErrNotFound
				}
			}
			_, err := h.Service.UpdateAbilityDomain(ctx, id, tenantID, &store.AbilityDomainParams{
				CareerPositionID: t.CareerPositionID,
				Name:             t.Name,
				Description:      t.Description,
				BindingIDs:       coalesceStringSlice(t.BindingIDs),
				SortOrder:        t.SortOrder,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Service.DeleteAbilityDomain(ctx, id, tenantID)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.AbilityDomain, error) {
			d, err := h.Service.GetAbilityDomain(ctx, id, tenantID)
			if err != nil {
				return domain.AbilityDomain{}, err
			}
			return *d, nil
		},
		TenantIDFn: func(t *domain.AbilityDomain) string {
			if t.TenantID == nil {
				return ""
			}
			return *t.TenantID
		},
	}
}

func (h *AbilityDomainHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *AbilityDomainHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *AbilityDomainHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *AbilityDomainHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
