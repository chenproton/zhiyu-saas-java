package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AbilityHandler struct {
	Service *service.PositionService
}

// AbilityRequest 能力点创建/更新请求体（字段一致）。
type AbilityRequest struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Category    string   `json:"category"`
	Attributes  []string `json:"attributes"`
	IsPublic    bool     `json:"isPublic"`
}

func (h *AbilityHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().Abilities().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListAbilities(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AbilityPoint]{Items: items, Total: total})
}

// crud 返回能力点 CRUD 差异配置；HTTP 流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *AbilityHandler) crud() crudConfig[AbilityRequest, domain.AbilityPoint] {
	return crudConfig[AbilityRequest, domain.AbilityPoint]{
		NotFoundMsg:        "能力点不存在",
		CreateErrMsg:       "创建能力点失败",
		UpdateErrMsg:       "更新能力点失败",
		DeleteErrMsg:       "删除能力点失败",
		UniqueViolationMsg: "能力点名称已存在，请使用其他名称",
		ValidateCreate: func(t *AbilityRequest) string {
			if t.Name == "" || t.Category == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *AbilityRequest) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *AbilityRequest) string {
			if t.Name == "" || t.Category == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *AbilityRequest, tenantID, userID string) (string, error) {
			d, err := h.Service.CreateAbility(ctx, tenantID, &store.AbilityPointParams{
				Name:        t.Name,
				Description: t.Description,
				Category:    t.Category,
				Attributes:  coalesceStringSlice(t.Attributes),
				IsPublic:    t.IsPublic,
				CreatorID:   userID,
			})
			if err != nil {
				return "", err
			}
			return d.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *AbilityRequest) error {
			_, err := h.Service.UpdateAbility(ctx, id, tenantID, &store.AbilityPointParams{
				Name:        t.Name,
				Description: t.Description,
				Category:    t.Category,
				Attributes:  coalesceStringSlice(t.Attributes),
				IsPublic:    t.IsPublic,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Service.DeleteAbility(ctx, id, tenantID)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.AbilityPoint, error) {
			d, err := h.Service.GetAbility(ctx, id, tenantID)
			if err != nil {
				return domain.AbilityPoint{}, err
			}
			return *d, nil
		},
		TenantFn: requireTenant,
	}
}

func (h *AbilityHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *AbilityHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *AbilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *AbilityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
