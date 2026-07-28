package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type InstitutionHandler struct {
	DB *pgxpool.Pool
}

type InstitutionListResponse struct {
	Items []interface{} `json:"items"`
	Total int           `json:"total"`
}

func (h *InstitutionHandler) List(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, InstitutionListResponse{Items: []interface{}{}, Total: 0})
}

func (h *InstitutionHandler) Get(w http.ResponseWriter, r *http.Request) {
	respondError(w, http.StatusNotFound, "机构不存在")
}

func (h *InstitutionHandler) Create(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *InstitutionHandler) Update(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *InstitutionHandler) Approve(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *InstitutionHandler) Disable(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
