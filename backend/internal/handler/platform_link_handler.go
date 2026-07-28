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

type PlatformLinkHandler struct {
	DB    *pgxpool.Pool
	Store *store.PlatformLinksStore
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
		ScanRows: h.Store.ScanRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询平台链接列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询平台链接列表失败")
		return
	}

	respondJSON(w, http.StatusOK, PlatformLinkListResponse{Items: items, Total: total})
}

func (h *PlatformLinkHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	link, err := h.Store.GetByID(r.Context(), id)
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

	_, err := h.Store.Upsert(r.Context(), store.PlatformLinkUpsertParams{
		Platform: req.Platform,
		URL:      req.URL,
		Enabled:  req.Enabled,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建平台链接失败")
		return
	}

	link, _ := h.Store.GetByPlatform(r.Context(), req.Platform)
	respondJSON(w, http.StatusCreated, link)
}

func (h *PlatformLinkHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "平台链接不存在")
		return
	}

	var req UpdatePlatformLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if err := h.Store.Update(r.Context(), id, store.PlatformLinkUpdateParams{
		URL:     req.URL,
		Enabled: req.Enabled,
	}); err != nil {
		respondError(w, http.StatusInternalServerError, "更新平台链接失败")
		return
	}

	link, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, link)
}

func (h *PlatformLinkHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "平台链接不存在")
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除平台链接失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
