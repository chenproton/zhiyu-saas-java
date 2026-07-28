package handler

import (
	"errors"
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type JobBannerHandler struct {
	DB *pgxpool.Pool
}

type JobBannerListResponse struct {
	Items []domain.JobBannerConfig `json:"items"`
	Total int               `json:"total"`
}

type CreateJobBannerRequest struct {
	Title     string  `json:"title"`
	ImageURL  string  `json:"imageUrl"`
	LinkURL   *string `json:"linkUrl"`
	SortOrder int     `json:"sortOrder"`
	IsEnabled  bool    `json:"isEnabled"`
}

type UpdateJobBannerRequest struct {
	Title     string  `json:"title"`
	ImageURL  string  `json:"imageUrl"`
	LinkURL   *string `json:"linkUrl"`
	SortOrder int     `json:"sortOrder"`
	IsEnabled  bool    `json:"isEnabled"`
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
		ScanRows: h.scanBannerRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
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
	banner, err := h.fetchBanner(r.Context(), id)
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

	id := uuid.NewString()

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO banner_configs (id, tenant_id, title, image_url, link_url, sort_order, is_enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, *claims.TenantID, req.Title, req.ImageURL, req.LinkURL, req.SortOrder, req.IsEnabled)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建轮播图失败")
		return
	}

	banner, _ := h.fetchBanner(r.Context(), id)
	respondJSON(w, http.StatusCreated, banner)
}

func (h *JobBannerHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchBanner(r.Context(), id); err != nil {
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

	_, err := h.DB.Exec(r.Context(), `
		UPDATE banner_configs SET
			title = $1, image_url = $2, link_url = $3, sort_order = $4, is_enabled = $5, updated_at = NOW()
		WHERE id = $6
	`, req.Title, req.ImageURL, req.LinkURL, req.SortOrder, req.IsEnabled, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新轮播图失败")
		return
	}

	banner, _ := h.fetchBanner(r.Context(), id)
	respondJSON(w, http.StatusOK, banner)
}

func (h *JobBannerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchBanner(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "轮播图不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM banner_configs WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除轮播图失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *JobBannerHandler) fetchBanner(ctx context.Context, id string) (domain.JobBannerConfig, error) {
	var b domain.JobBannerConfig
	var linkURL *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at
		FROM banner_configs WHERE id = $1
	`, id).Scan(
		&b.ID, &b.Title, &b.ImageURL, &linkURL, &b.SortOrder, &b.IsEnabled, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return b, err
	}
	b.LinkURL = linkURL
	return b, nil
}

func (h *JobBannerHandler) scanBannerRows(rows pgx.Rows) ([]domain.JobBannerConfig, error) {
	items := make([]domain.JobBannerConfig, 0)
	for rows.Next() {
		var b domain.JobBannerConfig
		var linkURL *string
		if err := rows.Scan(
			&b.ID, &b.Title, &b.ImageURL, &linkURL, &b.SortOrder, &b.IsEnabled, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		b.LinkURL = linkURL
		items = append(items, b)
	}
	return items, nil
}
