package handler

import (
	"context"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type JobBannerHandler struct {
	Service *service.PositionService
}

// JobBannerRequest 轮播图创建/更新请求体（字段一致）。
type JobBannerRequest struct {
	Title     string  `json:"title"`
	ImageURL  string  `json:"imageUrl"`
	LinkURL   *string `json:"linkUrl"`
	SortOrder int     `json:"sortOrder"`
	IsEnabled bool    `json:"isEnabled"`
}

func (h *JobBannerHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	cfg := h.Service.Store().Banners().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListBanners(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.JobBannerConfig]{Items: items, Total: total})
}

// crud 返回轮播图 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *JobBannerHandler) crud() crudConfig[JobBannerRequest, domain.JobBannerConfig] {
	return crudConfig[JobBannerRequest, domain.JobBannerConfig]{
		NotFoundMsg:  "轮播图不存在",
		CreateErrMsg: "创建轮播图失败",
		UpdateErrMsg: "更新轮播图失败",
		DeleteErrMsg: "删除轮播图失败",
		ValidateCreate: func(t *JobBannerRequest) string {
			if t.Title == "" || t.ImageURL == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *JobBannerRequest) (string, bool) {
			return requireTenant(w, r)
		},
		ValidateUpdate: func(t *JobBannerRequest) string {
			if t.Title == "" || t.ImageURL == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *JobBannerRequest, tenantID, userID string) (string, error) {
			b, err := h.Service.CreateBanner(ctx, tenantID, &store.BannerParams{
				Title:     t.Title,
				ImageURL:  t.ImageURL,
				LinkURL:   t.LinkURL,
				SortOrder: t.SortOrder,
				IsEnabled: t.IsEnabled,
			})
			if err != nil {
				return "", err
			}
			return b.ID, nil
		},
		UpdateFn: func(ctx context.Context, id, _ string, t *JobBannerRequest) error {
			_, err := h.Service.UpdateBanner(ctx, id, &store.BannerParams{
				Title:     t.Title,
				ImageURL:  t.ImageURL,
				LinkURL:   t.LinkURL,
				SortOrder: t.SortOrder,
				IsEnabled: t.IsEnabled,
			})
			return err
		},
		DeleteFn: func(ctx context.Context, id, _ string) error {
			return h.Service.DeleteBanner(ctx, id)
		},
		GetByIDFn: func(ctx context.Context, id, _ string) (domain.JobBannerConfig, error) {
			b, err := h.Service.GetBanner(ctx, id)
			if err != nil {
				return domain.JobBannerConfig{}, err
			}
			return *b, nil
		},
	}
}

func (h *JobBannerHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *JobBannerHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *JobBannerHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *JobBannerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
}
