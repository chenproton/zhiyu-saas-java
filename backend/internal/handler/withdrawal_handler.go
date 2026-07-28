package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type WithdrawalHandler struct {
	DB *pgxpool.Pool
}

type WithdrawalListResponse struct {
	Items []interface{} `json:"items"`
	Total int           `json:"total"`
}

func (h *WithdrawalHandler) List(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, WithdrawalListResponse{Items: []interface{}{}, Total: 0})
}

func (h *WithdrawalHandler) Create(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *WithdrawalHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
