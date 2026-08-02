package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type JobBannerHandler struct {
	Service *service.PositionService
}

type JobBannerListResponse struct {
	Items []domain.JobBannerConfig `json:"items"`
	Total int                      `json:"total"`
}

type CreateJobBannerRequest struct {
	Title     string  `json:"title"`
	ImageURL  string  `json:"imageUrl"`
	LinkURL   *string `json:"linkUrl"`
	SortOrder int     `json:"sortOrder"`
	IsEnabled bool    `json:"isEnabled"`
}

type UpdateJobBannerRequest struct {
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
	isEnabledStr := r.URL.Query().Get("isEnabled")
	cfg := store.ListQueryConfig[domain.JobBannerConfig]{
		Table:         "banner_configs",
		SelectColumns: "id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at",
		TenantScoped:  true,
		OrderBy:       "sort_order ASC, created_at DESC",
		ScanRows:      store.ScanBannerRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if isEnabledStr != "" {
				qb.AddCondition("is_enabled = " + qb.NextArg(isEnabledStr == "true"))
			}
		},
	}
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
	respondJSON(w, http.StatusOK, JobBannerListResponse{Items: items, Total: total})
}

func (h *JobBannerHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	banner, err := h.Service.GetBanner(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "轮播图不存在")
		return
	}
	respondJSON(w, http.StatusOK, banner)
}

func (h *JobBannerHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var req CreateJobBannerRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Title == "" || req.ImageURL == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	banner, err := h.Service.CreateBanner(r.Context(), *claims.TenantID, &store.BannerParams{
		Title:     req.Title,
		ImageURL:  req.ImageURL,
		LinkURL:   req.LinkURL,
		SortOrder: req.SortOrder,
		IsEnabled: req.IsEnabled,
	})
	if err != nil {
		respondServerError(w, r, err, "创建轮播图失败")
		return
	}
	respondJSON(w, http.StatusCreated, banner)
}

func (h *JobBannerHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetBanner(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "轮播图不存在")
		return
	}
	var req UpdateJobBannerRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Title == "" || req.ImageURL == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	banner, err := h.Service.UpdateBanner(r.Context(), id, &store.BannerParams{
		Title:     req.Title,
		ImageURL:  req.ImageURL,
		LinkURL:   req.LinkURL,
		SortOrder: req.SortOrder,
		IsEnabled: req.IsEnabled,
	})
	if err != nil {
		respondServerError(w, r, err, "更新轮播图失败")
		return
	}
	respondJSON(w, http.StatusOK, banner)
}

func (h *JobBannerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetBanner(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "轮播图不存在")
		return
	}
	if err := h.Service.DeleteBanner(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除轮播图失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
