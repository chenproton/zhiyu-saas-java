package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PositionCertificateHandler struct {
	Service *service.PositionConfigService
}

// PositionCertificateRequest 岗位证书创建/更新请求体（字段一致）。
type PositionCertificateRequest struct {
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	URL              *string `json:"url"`
	Description      *string `json:"description"`
	ImageURL         *string `json:"imageUrl"`
}

func (h *PositionCertificateHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	limit := 50
	if v, err := parsePageLimit(r.URL.Query().Get("limit"), 50); err == nil && v > 0 {
		limit = v
	}
	offset := 0
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		offset = v
	}

	items, total, err := h.Service.ListCertificates(r.Context(), r.URL.Query().Get("careerPositionId"), limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询证书失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PositionCertificate]{Items: items, Total: total})
}

// checkCertTenant 校验证书所属岗位归属当前租户，不匹配时按不存在处理。
func (h *PositionCertificateHandler) checkCertTenant(ctx context.Context, id, tenantID string) error {
	item, err := h.Service.GetCertificate(ctx, id)
	if err != nil {
		return err
	}
	posTenant, err := h.Service.PositionTenantID(ctx, item.CareerPositionID)
	if err != nil {
		return err
	}
	if posTenant != tenantID {
		return store.ErrNotFound
	}
	return nil
}

// crud 返回岗位证书 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
// Get/Update/Delete 按证书所属岗位校验租户归属，防跨租户读写。
func (h *PositionCertificateHandler) crud() crudConfig[PositionCertificateRequest, domain.PositionCertificate] {
	return crudConfig[PositionCertificateRequest, domain.PositionCertificate]{
		NotFoundMsg:  "证书不存在",
		CreateErrMsg: "创建证书失败",
		UpdateErrMsg: "更新证书失败",
		DeleteErrMsg: "删除证书失败",
		ValidateCreate: func(t *PositionCertificateRequest) string {
			if t.CareerPositionID == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *PositionCertificateRequest) (string, bool) {
			// 与原实现一致：容忍空租户，不返回 403
			claims := middleware.CurrentUser(r)
			if claims == nil || claims.TenantID == nil {
				return "", true
			}
			return *claims.TenantID, true
		},
		TenantFn: func(w http.ResponseWriter, r *http.Request) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *PositionCertificateRequest) string {
			if t.CareerPositionID == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *PositionCertificateRequest, tenantID, userID string) (string, error) {
			item, err := h.Service.CreateCertificate(ctx, tenantID, &store.PositionCertificateParams{
				CareerPositionID: t.CareerPositionID,
				Name:             t.Name,
				URL:              t.URL,
				Description:      t.Description,
				ImageURL:         t.ImageURL,
			})
			if err != nil {
				return "", err
			}
			return item.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *PositionCertificateRequest) error {
			if err := h.checkCertTenant(ctx, id, tenantID); err != nil {
				return err
			}
			_, err := h.Service.UpdateCertificate(ctx, tenantID, &store.PositionCertificateUpdateParams{
				ID:               id,
				CareerPositionID: t.CareerPositionID,
				Name:             t.Name,
				URL:              t.URL,
				Description:      t.Description,
				ImageURL:         t.ImageURL,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			if err := h.checkCertTenant(ctx, id, tenantID); err != nil {
				return err
			}
			return h.Service.DeleteCertificate(ctx, id)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.PositionCertificate, error) {
			if err := h.checkCertTenant(ctx, id, tenantID); err != nil {
				return domain.PositionCertificate{}, err
			}
			item, err := h.Service.GetCertificate(ctx, id)
			if err != nil {
				return domain.PositionCertificate{}, err
			}
			return *item, nil
		},
	}
}

func (h *PositionCertificateHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *PositionCertificateHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *PositionCertificateHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *PositionCertificateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
