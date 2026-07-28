package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type JobBannerHandler struct {
	DB    *pgxpool.Pool
	Store *store.JobBannersStore
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

	items, total, err := executeListQuery[domain.JobBannerConfig](r.Context(), h.DB, r, listQueryConfig[domain.JobBannerConfig]{
		Table:         "banner_configs",
		SelectColumns: "id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at",
		TenantScoped:  true,
		OrderBy:       "sort_order ASC, created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if isEnabledStr != "" {
				qb.addCondition("is_enabled = " + qb.nextArg(isEnabledStr == "true"))
			}
		},
		ScanRows: h.Store.ScanRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询岗位横幅列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询岗位横幅列表失败")
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
	banner, err := h.Store.GetByID(r.Context(), id)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Title == "" || req.ImageURL == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id, err := h.Store.Create(r.Context(), store.JobBannerCreateParams{
		TenantID:  *claims.TenantID,
		Title:     req.Title,
		ImageURL:  req.ImageURL,
		LinkURL:   req.LinkURL,
		SortOrder: req.SortOrder,
		IsEnabled: req.IsEnabled,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建轮播图失败")
		return
	}

	banner, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, banner)
}

func (h *JobBannerHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "轮播图不存在")
		return
	}

	var req UpdateJobBannerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Title == "" || req.ImageURL == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if err := h.Store.Update(r.Context(), id, store.JobBannerUpdateParams{
		Title:     req.Title,
		ImageURL:  req.ImageURL,
		LinkURL:   req.LinkURL,
		SortOrder: req.SortOrder,
		IsEnabled: req.IsEnabled,
	}); err != nil {
		respondError(w, http.StatusInternalServerError, "更新轮播图失败")
		return
	}

	banner, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, banner)
}

func (h *JobBannerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "轮播图不存在")
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除轮播图失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
