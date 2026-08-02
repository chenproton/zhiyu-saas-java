package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type OrgTypeHandler struct {
	Service *service.OrgTypeService
	Store   *store.OrgTypesStore
}

// OrgTypeRequest 组织类型创建/更新请求体（更新流程忽略 tenantId）。
type OrgTypeRequest struct {
	TenantID    string                 `json:"tenantId"`
	Name        string                 `json:"name"`
	Category    domain.OrgTypeCategory `json:"category"`
	Description *string                `json:"description"`
}

func (h *OrgTypeHandler) List(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.OrgType](r.Context(), h.Service.Queryer(), r, store.ListQueryConfig[domain.OrgType]{
		Table:         "org_types",
		SelectColumns: "id, tenant_id, name, category, description, is_default, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if tenantID := p.Values["tenantId"]; tenantID != "" {
				qb.AddCondition("tenant_id = " + qb.NextArg(tenantID))
			}
			if category := p.Values["category"]; category != "" {
				qb.AddCondition("category = " + qb.NextArg(category))
			}
		},
		ScanRows: h.Store.ScanRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询组织类型失败", "error", err)
		respondServerError(w, r, err, "查询组织类型失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.OrgType]{Items: items, Total: total})
}

// crud 返回组织类型 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *OrgTypeHandler) crud() crudConfig[OrgTypeRequest, domain.OrgType] {
	return crudConfig[OrgTypeRequest, domain.OrgType]{
		NotFoundMsg:        "组织类型不存在",
		CreateErrMsg:       "创建组织类型失败",
		UpdateErrMsg:       "更新组织类型失败",
		DeleteErrMsg:       "删除组织类型失败",
		DeleteCheckErrMsg:  "检查组织类型引用失败",
		Permit:             func(r *http.Request) bool { return canManagePortal(middleware.CurrentUser(r)) },
		UniqueViolationMsg: "组织类型名称已存在，请使用其他名称",
		CheckOwnership:     true,
		GetOwnership:       true,
		ValidateCreate: func(t *OrgTypeRequest) string {
			if t.TenantID == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *OrgTypeRequest) (string, bool) {
			return t.TenantID, verifyRequestTenant(w, r, t.TenantID)
		},
		PrepareCreate: func(t *OrgTypeRequest, tenantID, userID string) {
			if t.Category != domain.OrgTypeCategoryInternal && t.Category != domain.OrgTypeCategoryBusiness && t.Category != domain.OrgTypeCategoryExternal {
				t.Category = domain.OrgTypeCategoryInternal
			}
		},
		ValidateUpdate: func(t *OrgTypeRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			if t.Category != domain.OrgTypeCategoryInternal && t.Category != domain.OrgTypeCategoryBusiness && t.Category != domain.OrgTypeCategoryExternal {
				return "无效分类"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *OrgTypeRequest, tenantID, userID string) (string, error) {
			return h.Store.Create(ctx, store.OrgTypeCreateParams{
				TenantID:    tenantID,
				Name:        t.Name,
				Category:    string(t.Category),
				Description: t.Description,
			})
		},
		UpdateFn: func(ctx context.Context, id string, t *OrgTypeRequest) error {
			return h.Store.Update(ctx, id, store.OrgTypeUpdateParams{
				Name:        t.Name,
				Category:    string(t.Category),
				Description: t.Description,
			})
		},
		DeleteFn: h.Store.Delete,
		GetByIDFn: func(ctx context.Context, id string) (domain.OrgType, error) {
			return h.Store.GetByID(ctx, id)
		},
		TenantIDFn: func(t *domain.OrgType) string { return t.TenantID },
		DeleteChecks: []func(ctx context.Context, t *domain.OrgType) (string, error){
			func(ctx context.Context, t *domain.OrgType) (string, error) {
				if t.IsDefault {
					return "系统默认组织类型不可删除", nil
				}
				count, err := h.Store.CountOrgRefs(ctx, t.ID)
				if err != nil {
					return "", err
				}
				if count > 0 {
					return "该组织类型仍被组织使用，不可删除", nil
				}
				return "", nil
			},
		},
	}
}

func (h *OrgTypeHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *OrgTypeHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *OrgTypeHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *OrgTypeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
