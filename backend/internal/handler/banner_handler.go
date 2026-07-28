package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type BannerHandler struct {
	DB *pgxpool.Pool
}

type BannerListResponse struct {
	Items []interface{} `json:"items"`
	Total int           `json:"total"`
}

func (h *BannerHandler) List(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, BannerListResponse{Items: []interface{}{}, Total: 0})
}

func (h *BannerHandler) Create(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *BannerHandler) Update(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *BannerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func requireOperator(r *http.Request) bool {
	claims := middleware.CurrentUser(r)
	return claims != nil && canManagePlatform(claims)
}
