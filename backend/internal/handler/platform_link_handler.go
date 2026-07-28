package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

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
	cfg := listQueryConfig[domain.PlatformLink]{
		Table:         "platform_links",
		SelectColumns: "id, platform, url, enabled",
		TenantScoped:  false,
		OrderBy:       "platform ASC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if platform := r.URL.Query().Get("platform"); platform != "" {
				qb.addCondition("platform = " + qb.nextArg(platform))
			}
			if enabledStr := r.URL.Query().Get("enabled"); enabledStr != "" {
				qb.addCondition("enabled = " + qb.nextArg(enabledStr == "true"))
			}
		},
		ScanRows: h.scanPlatformLinkRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
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
