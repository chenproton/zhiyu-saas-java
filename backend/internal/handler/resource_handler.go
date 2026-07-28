package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ResourceHandler 当前为占位实现，所有方法返回空数据或成功占位响应。
// TODO: 对接实际的 resource 数据表后实现具体 CRUD 逻辑。
type ResourceHandler struct {
	DB *pgxpool.Pool
}

type ResourceListResponse struct {
	Items []interface{} `json:"items"`
	Total int           `json:"total"`
}

func (h *ResourceHandler) List(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, ResourceListResponse{Items: []interface{}{}, Total: 0})
}

func (h *ResourceHandler) Get(w http.ResponseWriter, r *http.Request) {
	respondError(w, http.StatusNotFound, "资源不存在")
}

func (h *ResourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ResourceHandler) Update(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ResourceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ResourceHandler) SubmitForReview(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ResourceHandler) Review(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ResourceHandler) Publish(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ResourceHandler) Offline(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ResourceHandler) IncrementView(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
