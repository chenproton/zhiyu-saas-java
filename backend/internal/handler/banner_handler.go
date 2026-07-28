package handler

import (
	"errors"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type BannerHandler struct {
	DB *pgxpool.Pool
}

type BannerListResponse struct {
	Items []domain.Banner `json:"items"`
	Total int             `json:"total"`
}

type CreateBannerRequest struct {
	Title   string `json:"title"`
	Image   string `json:"image"`
	Link    string `json:"link"`
	Sort    int    `json:"sort"`
	Enabled bool   `json:"enabled"`
}

func (h *BannerHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := listQueryConfig[domain.Banner]{
		Table:         "banners",
		SelectColumns: "id, title, image, link, sort, enabled",
		TenantScoped:  false,
		OrderBy:       "sort, id",
		ScanRows:      h.scanBannerRows,
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

	respondJSON(w, http.StatusOK, BannerListResponse{Items: items, Total: total})
}

func (h *BannerHandler) scanBannerRows(rows pgx.Rows) ([]domain.Banner, error) {
	items := make([]domain.Banner, 0)
	for rows.Next() {
		var b domain.Banner
		if err := rows.Scan(&b.ID, &b.Title, &b.Image, &b.Link, &b.Sort, &b.Enabled); err != nil {
			return nil, err
		}
		items = append(items, b)
	}
	return items, nil
}

func (h *BannerHandler) Create(w http.ResponseWriter, r *http.Request) {
	if !requireOperator(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateBannerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO banners (id, title, image, link, sort, enabled) VALUES ($1, $2, $3, $4, $5, $6)
	`, id, req.Title, req.Image, req.Link, req.Sort, req.Enabled)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建轮播图失败")
		return
	}

	respondJSON(w, http.StatusCreated, domain.Banner{ID: id, Title: req.Title, Image: req.Image, Link: req.Link, Sort: req.Sort, Enabled: req.Enabled})
}

func (h *BannerHandler) Update(w http.ResponseWriter, r *http.Request) {
	if !requireOperator(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	var req CreateBannerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE banners SET title = $1, image = $2, link = $3, sort = $4, enabled = $5 WHERE id = $6
	`, req.Title, req.Image, req.Link, req.Sort, req.Enabled, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新轮播图失败")
		return
	}

	respondJSON(w, http.StatusOK, domain.Banner{ID: id, Title: req.Title, Image: req.Image, Link: req.Link, Sort: req.Sort, Enabled: req.Enabled})
}

func (h *BannerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !requireOperator(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `DELETE FROM banners WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除轮播图失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func requireOperator(r *http.Request) bool {
	claims := middleware.CurrentUser(r)
	return claims != nil && canManagePlatform(claims)
}
