package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PositionResponsibilityHandler struct {
	Service *service.PositionConfigService
}

// PositionResponsibilityRequest 岗位职责创建/更新请求体（字段一致）。
type PositionResponsibilityRequest struct {
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	SortOrder        int     `json:"sortOrder"`
}

func (h *PositionResponsibilityHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().PositionResponsibilities().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListResponsibilities(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询岗位职责失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PositionResponsibility]{Items: items, Total: total})
}

// crud 返回岗位职责 CRUD 差异配置；HTTP 流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
// 职责无 tenant_id 列，租户归属为"间接归属"（经关联岗位确定）：
// GetByIDFn 内完成 获取→查岗位租户→比对调用方租户，不匹配返回 ErrNotFound（404）；
// CreateTenantFn 创建时校验岗位归属（403）。
func (h *PositionResponsibilityHandler) crud() crudConfig[PositionResponsibilityRequest, domain.PositionResponsibility] {
	return crudConfig[PositionResponsibilityRequest, domain.PositionResponsibility]{
		NotFoundMsg:  "岗位职责不存在",
		CreateErrMsg: "创建岗位职责失败",
		UpdateErrMsg: "更新岗位职责失败",
		DeleteErrMsg: "删除岗位职责失败",
		ValidateCreate: func(t *PositionResponsibilityRequest) string {
			if t.CareerPositionID == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *PositionResponsibilityRequest) (string, bool) {
			positionTenantID, err := h.Service.PositionTenantID(r.Context(), t.CareerPositionID)
			if err != nil {
				respondError(w, http.StatusNotFound, "岗位不存在")
				return "", false
			}
			if !verifyTenantOwnership(w, r, positionTenantID) {
				return "", false
			}
			return positionTenantID, true
		},
		ValidateUpdate: func(t *PositionResponsibilityRequest) string {
			if t.CareerPositionID == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *PositionResponsibilityRequest, tenantID, userID string) (string, error) {
			item, err := h.Service.CreateResponsibility(ctx, &store.PositionResponsibilityParams{
				TenantID:         tenantID,
				CareerPositionID: t.CareerPositionID,
				Name:             t.Name,
				Description:      t.Description,
				SortOrder:        t.SortOrder,
			})
			if err != nil {
				return "", err
			}
			return item.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *PositionResponsibilityRequest) error {
			// 校验目标岗位属于当前租户（职责移动路径），防止跨租户写
			if t.CareerPositionID != "" {
				posTenant, err := h.Service.PositionTenantID(ctx, t.CareerPositionID)
				if err != nil || posTenant != tenantID {
					return store.ErrNotFound
				}
			}
			_, err := h.Service.UpdateResponsibility(ctx, id, &store.PositionResponsibilityParams{
				CareerPositionID: t.CareerPositionID,
				Name:             t.Name,
				Description:      t.Description,
				SortOrder:        t.SortOrder,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, _ string) error {
			return h.Service.DeleteResponsibility(ctx, id)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.PositionResponsibility, error) {
			item, err := h.Service.GetResponsibility(ctx, id)
			if err != nil {
				return domain.PositionResponsibility{}, err
			}
			// 间接租户归属校验：实体无 tenant_id，经关联岗位确认租户
			positionTenantID, err := h.Service.PositionTenantID(ctx, item.CareerPositionID)
			if err != nil || positionTenantID != tenantID {
				return domain.PositionResponsibility{}, store.ErrNotFound
			}
			return *item, nil
		},
		TenantFn: requireTenant,
	}
}

func (h *PositionResponsibilityHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *PositionResponsibilityHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *PositionResponsibilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *PositionResponsibilityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
