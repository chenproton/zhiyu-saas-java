package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ResourceCodeHandler struct {
	Service *service.PositionService
}

// ResourceCodeRequest 资源编码创建/更新请求体（更新时忽略 tenantId/code）。
type ResourceCodeRequest struct {
	TenantID    string  `json:"tenantId"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Type        string  `json:"type"`
}

func (h *ResourceCodeHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := h.Service.Store().ResourceCodes().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListResourceCodes(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询资源编码失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ResourceCode]{Items: items, Total: total})
}

// crud 返回资源编码 CRUD 差异配置；HTTP 流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
// 仅门户管理（canManagePortal）可写，读仅需登录 + 租户归属校验。
func (h *ResourceCodeHandler) crud() crudConfig[ResourceCodeRequest, domain.ResourceCode] {
	return crudConfig[ResourceCodeRequest, domain.ResourceCode]{
		NotFoundMsg:        "资源编码不存在",
		CreateErrMsg:       "创建资源编码失败",
		UpdateErrMsg:       "更新资源编码失败",
		DeleteErrMsg:       "删除资源编码失败",
		UniqueViolationMsg: "资源编码代码已存在，请使用其他代码",
		Permit: func(r *http.Request) bool {
			return canManagePortal(middleware.CurrentUser(r))
		},
		// 读仅需登录，租户归属由 GetOwnership 校验。
		PermitGet:      nil,
		CheckOwnership: true,
		GetOwnership:   true,
		ValidateCreate: func(t *ResourceCodeRequest) string {
			if t.TenantID == "" || t.Code == "" || t.Name == "" || t.Type == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *ResourceCodeRequest) (string, bool) {
			if !verifyRequestTenant(w, r, t.TenantID) {
				return "", false
			}
			return t.TenantID, true
		},
		ValidateUpdate: func(t *ResourceCodeRequest) string {
			if t.Name == "" || t.Type == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *ResourceCodeRequest, tenantID, userID string) (string, error) {
			rc, err := h.Service.CreateResourceCode(ctx, &store.ResourceCodeParams{
				TenantID: t.TenantID, Code: t.Code, Name: t.Name, Description: t.Description, Type: t.Type,
			})
			if err != nil {
				return "", err
			}
			return rc.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, _ string, t *ResourceCodeRequest) error {
			_, err := h.Service.UpdateResourceCode(ctx, id, &store.ResourceCodeParams{
				Name: t.Name, Description: t.Description, Type: t.Type,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, _ string) error {
			return h.Service.DeleteResourceCode(ctx, id)
		},
		GetByIDFn: func(ctx context.Context, id, _ string) (domain.ResourceCode, error) {
			rc, err := h.Service.GetResourceCode(ctx, id)
			if err != nil {
				return domain.ResourceCode{}, err
			}
			return *rc, nil
		},
		TenantIDFn: func(t *domain.ResourceCode) string {
			return t.TenantID
		},
	}
}

func (h *ResourceCodeHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *ResourceCodeHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *ResourceCodeHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *ResourceCodeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
