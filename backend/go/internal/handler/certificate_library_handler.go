package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"

	"github.com/zhiyu-saas/backend/internal/store"
)

type CertificateLibraryHandler struct {
	Store *store.CertificateLibraryStore
}

// CertificateLibraryRequest 证书创建/更新请求体（均为可选字段，更新时按需合并）。
type CertificateLibraryRequest struct {
	Name        *string `json:"name"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	ImageURL    *string `json:"imageUrl"`
}

func (h *CertificateLibraryHandler) List(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.CertificateLibraryItem](r.Context(), h.Store.Q(), r, h.Store.ListConfig())
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询证书库列表失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.CertificateLibraryItem]{Items: items, Total: total})
}

// crud 返回证书库 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *CertificateLibraryHandler) crud() crudConfig[CertificateLibraryRequest, domain.CertificateLibraryItem] {
	return crudConfig[CertificateLibraryRequest, domain.CertificateLibraryItem]{
		NotFoundMsg:  "证书不存在",
		CreateErrMsg: "创建证书失败",
		UpdateErrMsg: "更新证书失败",
		DeleteErrMsg: "删除证书失败",
		// 仅需登录即可查看/创建，更新/删除校验租户归属；详情读取同样校验租户（防跨租户 IDOR）
		CheckOwnership: true,
		GetOwnership:   true,
		ValidateCreate: func(t *CertificateLibraryRequest) string {
			if t.Name == nil || *t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *CertificateLibraryRequest) (string, bool) {
			return requireTenant(w, r)
		},
		TenantFn: requireTenant,
		CreateFn: func(ctx context.Context, t *CertificateLibraryRequest, tenantID, userID string) (string, error) {
			return h.Store.Create(ctx, store.CertificateLibraryCreateParams{
				TenantID:    tenantID,
				Name:        *t.Name,
				URL:         t.URL,
				Description: t.Description,
				ImageURL:    t.ImageURL,
				CreatorID:   userID,
			})
		},
		UpdateFn: func(ctx context.Context, id, tenantID string, t *CertificateLibraryRequest) error {
			existing, err := h.Store.GetByID(ctx, id, tenantID)
			if err != nil {
				return err
			}
			updateName := existing.Name
			if t.Name != nil {
				updateName = *t.Name
			}
			updateURL := ""
			if t.URL != nil {
				updateURL = *t.URL
			} else if existing.URL != nil {
				updateURL = *existing.URL
			}
			updateDesc := t.Description
			if updateDesc == nil {
				updateDesc = existing.Description
			}
			updateImg := t.ImageURL
			if updateImg == nil {
				updateImg = existing.ImageURL
			}
			return h.Store.Update(ctx, id, tenantID, store.CertificateLibraryUpdateParams{
				Name:        updateName,
				URL:         updateURL,
				Description: updateDesc,
				ImageURL:    updateImg,
			})
		},
		DeleteFn: func(ctx context.Context, id, tenantID string) error {
			return h.Store.Delete(ctx, id, tenantID)
		},
		GetByIDFn: func(ctx context.Context, id, tenantID string) (domain.CertificateLibraryItem, error) {
			return h.Store.GetByID(ctx, id, tenantID)
		},
		TenantIDFn: func(t *domain.CertificateLibraryItem) string { return t.TenantID },
	}
}

func (h *CertificateLibraryHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *CertificateLibraryHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *CertificateLibraryHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *CertificateLibraryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}

// CitationStats 证书引用次数分布（顶部指标卡片用）。
func (h *CertificateLibraryHandler) CitationStats(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	stats, err := h.Store.CitationStats(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询证书引用统计失败")
		return
	}
	respondJSON(w, http.StatusOK, stats)
}

// UncitedList 零引用证书列表（弹窗：创建时段筛选 + 分页）。
func (h *CertificateLibraryHandler) UncitedList(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	from, to, ok := parseDateRange(w, r)
	if !ok {
		return
	}
	limit, offset := parseLimitOffset(r, 20)
	items, total, err := h.Store.ListUncited(r.Context(), tenantID, from, to, limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询零引用证书失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[store.UncitedItem]{Items: items, Total: total})
}
