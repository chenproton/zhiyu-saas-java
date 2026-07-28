package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type JobBannerHandler struct {
	DB *pgxpool.Pool
}

type JobBannerConfig struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	ImageURL  string    `json:"imageUrl"`
	LinkURL   *string   `json:"linkUrl,omitempty"`
	SortOrder int       `json:"sortOrder"`
	IsEnabled  bool      `json:"isEnabled"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type JobBannerListResponse struct {
	Items []JobBannerConfig `json:"items"`
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

	isActiveStr := r.URL.Query().Get("isEnabled")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if isActiveStr != "" {
		where = append(where, "is_enabled = $"+itoa(argIdx))
		args = append(args, isActiveStr == "true")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM banner_configs WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at
		FROM banner_configs
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY sort_order ASC, created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询轮播图失败")
		return
	}
	defer rows.Close()

	items, err := h.scanBannerRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取轮播图失败")
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

func (h *JobBannerHandler) fetchBanner(ctx context.Context, id string) (JobBannerConfig, error) {
	var b JobBannerConfig
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

func (h *JobBannerHandler) scanBannerRows(rows pgx.Rows) ([]JobBannerConfig, error) {
	items := make([]JobBannerConfig, 0)
	for rows.Next() {
		var b JobBannerConfig
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
