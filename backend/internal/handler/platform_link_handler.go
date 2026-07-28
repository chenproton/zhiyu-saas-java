package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type PlatformLinkHandler struct {
	DB *pgxpool.Pool
}

type PlatformLinkListResponse struct {
	Items []domain.PlatformLink `json:"items"`
	Total int                   `json:"total"`
}

type CreatePlatformLinkRequest struct {
	Platform string `json:"platform"`
	URL      string `json:"url"`
	Enabled  bool   `json:"enabled"`
}

type UpdatePlatformLinkRequest struct {
	URL     string `json:"url"`
	Enabled bool   `json:"enabled"`
}

func (h *PlatformLinkHandler) List(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")
	enabledStr := r.URL.Query().Get("enabled")
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

	if platform != "" {
		where = append(where, "platform = $"+itoa(argIdx))
		args = append(args, platform)
		argIdx++
	}
	if enabledStr != "" {
		where = append(where, "enabled = $"+itoa(argIdx))
		args = append(args, enabledStr == "true")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM platform_links WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, platform, url, enabled
		FROM platform_links
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY platform ASC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询平台链接失败")
		return
	}
	defer rows.Close()

	items, err := h.scanPlatformLinkRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取平台链接失败")
		return
	}

	respondJSON(w, http.StatusOK, PlatformLinkListResponse{Items: items, Total: total})
}

func (h *PlatformLinkHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	link, err := h.fetchPlatformLink(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "平台链接不存在")
		return
	}
	respondJSON(w, http.StatusOK, link)
}

func (h *PlatformLinkHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreatePlatformLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Platform == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id := uuid.NewString()

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO platform_links (id, platform, url, enabled)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (platform) DO UPDATE SET url = EXCLUDED.url, enabled = EXCLUDED.enabled
	`, id, req.Platform, req.URL, req.Enabled)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建平台链接失败")
		return
	}

	link, _ := h.fetchPlatformLinkByPlatform(r.Context(), req.Platform)
	respondJSON(w, http.StatusCreated, link)
}

func (h *PlatformLinkHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchPlatformLink(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "平台链接不存在")
		return
	}

	var req UpdatePlatformLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE platform_links SET url = $1, enabled = $2
		WHERE id = $3
	`, req.URL, req.Enabled, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新平台链接失败")
		return
	}

	link, _ := h.fetchPlatformLink(r.Context(), id)
	respondJSON(w, http.StatusOK, link)
}

func (h *PlatformLinkHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchPlatformLink(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "平台链接不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM platform_links WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除平台链接失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *PlatformLinkHandler) fetchPlatformLink(ctx context.Context, id string) (domain.PlatformLink, error) {
	var link domain.PlatformLink

	err := h.DB.QueryRow(ctx, `
		SELECT id, platform, url, enabled
		FROM platform_links WHERE id = $1
	`, id).Scan(
		&link.ID, &link.Platform, &link.URL, &link.Enabled,
	)
	return link, err
}

func (h *PlatformLinkHandler) fetchPlatformLinkByPlatform(ctx context.Context, platform string) (domain.PlatformLink, error) {
	var link domain.PlatformLink

	err := h.DB.QueryRow(ctx, `
		SELECT id, platform, url, enabled
		FROM platform_links WHERE platform = $1
	`, platform).Scan(
		&link.ID, &link.Platform, &link.URL, &link.Enabled,
	)
	return link, err
}

func (h *PlatformLinkHandler) scanPlatformLinkRows(rows pgx.Rows) ([]domain.PlatformLink, error) {
	items := make([]domain.PlatformLink, 0)
	for rows.Next() {
		var link domain.PlatformLink
		if err := rows.Scan(
			&link.ID, &link.Platform, &link.URL, &link.Enabled,
		); err != nil {
			return nil, err
		}
		items = append(items, link)
	}
	return items, nil
}
