package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type TaskResourceHandler struct {
	Service *service.ResourceBindingService
}

type TaskResourceListResponse struct {
	Items []domain.TaskResource `json:"items"`
	Total int                   `json:"total"`
}

type CreateTaskResourceRequest struct {
	Name              string           `json:"name"`
	Type              string           `json:"type"`
	URL               *string          `json:"url"`
	Description       *string          `json:"description"`
	Thumbnail         *string          `json:"thumbnail"`
	Size              *string          `json:"size"`
	KnowledgePointIDs []string         `json:"knowledgePointIds"`
	ExtraData         domain.JSONMap   `json:"extraData"`
}

type BindTaskResourceRequest struct {
	TaskID     string `json:"taskId"`
	ResourceID string `json:"resourceId"`
}

func toTaskResource(r *store.ResourceRow) domain.TaskResource {
	res := domain.TaskResource{
		ID:          r.ID,
		Name:        r.Name,
		Type:        r.Type,
		URL:         r.URL,
		Description: r.Description,
		Thumbnail:   r.Thumbnail,
		Size:        &r.Size,
		UploadedBy:  r.UploadedBy,
		UploadedAt:  r.UploadedAt,
	}
	if r.KnowledgePointRaw != "" {
		var kp []string
		if err := json.Unmarshal([]byte(r.KnowledgePointRaw), &kp); err == nil {
			res.KnowledgePointIDs = kp
		}
	}
	return res
}

func (h *TaskResourceHandler) ListResources(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}
	tenantID, ok := tenantFilter(middleware.CurrentUser(r))
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	limit := 50
	if v, err := parsePageLimit(r.URL.Query().Get("limit"), 50); err == nil && v > 0 {
		limit = v
	}
	offset := 0
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		offset = v
	}
	taskID := r.URL.Query().Get("taskId")
	search := r.URL.Query().Get("search")

	var bind *store.BindingTable
	if taskID != "" {
		bind = &store.BindingTable{Table: "task_resource_bindings", IDCol: "task_id"}
	}
	rows, total, err := h.Service.List(r.Context(), tenantID, search, bind, taskID, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询资源失败")
		return
	}
	items := make([]domain.TaskResource, 0, len(rows))
	for i := range rows {
		items = append(items, toTaskResource(&rows[i]))
	}
	respondJSON(w, http.StatusOK, TaskResourceListResponse{Items: items, Total: total})
}

func (h *TaskResourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req CreateTaskResourceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	metadata := domain.JSONMap{}
	if req.ExtraData != nil {
		for k, v := range req.ExtraData {
			metadata[k] = v
		}
	}
	metadata["knowledgePointIds"] = req.KnowledgePointIDs

	var fileSize *int64
	if req.Size != nil && *req.Size != "" {
		if parsed, err := parseInt(*req.Size, 0); err == nil {
			s := int64(parsed)
			fileSize = &s
		}
	}
	uploadedBy := claims.UserID

	row, err := h.Service.Create(r.Context(), tenantID, "", "", "", &store.ResourceCreateSimpleParams{
		Name:        req.Name,
		Type:        req.Type,
		URL:         req.URL,
		Description: req.Description,
		Thumbnail:   req.Thumbnail,
		FileSize:    fileSize,
		Metadata:    jsonMapBytes(metadata),
		UploadedBy:  &uploadedBy,
	}, nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建资源失败")
		return
	}
	respondJSON(w, http.StatusCreated, toTaskResource(row))
}

func (h *TaskResourceHandler) BindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req BindTaskResourceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TaskID == "" || req.ResourceID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id, err := h.Service.Bind(r.Context(), tenantID, "task_resource_bindings", "task_id", req.TaskID, req.ResourceID, nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "绑定资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *TaskResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.Service.Unbind(r.Context(), "task_resource_bindings", id, nil); err != nil {
		respondError(w, http.StatusInternalServerError, "解绑资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
