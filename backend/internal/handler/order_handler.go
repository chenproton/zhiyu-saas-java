package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type OrderHandler struct {
	DB *pgxpool.Pool
}

type OrderListResponse struct {
	Items []interface{} `json:"items"`
	Total int           `json:"total"`
}

func (h *OrderHandler) List(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, OrderListResponse{Items: []interface{}{}, Total: 0})
}

func (h *OrderHandler) Get(w http.ResponseWriter, r *http.Request) {
	respondError(w, http.StatusNotFound, "订单不存在")
}

func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *OrderHandler) Pay(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *OrderHandler) ListAuthorizations(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": []interface{}{}, "total": 0})
}

func (h *OrderHandler) VerifyAuthorization(w http.ResponseWriter, r *http.Request) {
	respondError(w, http.StatusNotFound, "无效授权码")
}
