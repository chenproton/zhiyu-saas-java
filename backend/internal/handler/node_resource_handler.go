package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type NodeResourceHandler struct {
	Service *service.ResourceBindingService
}

type NodeResourceListResponse struct {
	Items []domain.NodeResource `json:"items"`
	Total int                   `json:"total"`
}

type CreateNodeResourceRequest struct {
	NodeID      string  `json:"nodeId"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	Size        *int    `json:"size"`
}

type BindNodeResourceRequest struct {
	NodeID     string `json:"nodeId"`
	ResourceID string `json:"resourceId"`
}

func (h *NodeResourceHandler) ListResources(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}
	tenantID, ok := tenantFilter(middleware.CurrentUser(r))
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	limit := 200
	if v, err := parsePageLimit(r.URL.Query().Get("limit"), 200); err == nil && v > 0 {
		limit = v
	}
	offset := 0
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		offset = v
	}
	nodeID := r.URL.Query().Get("nodeId")
	search := r.URL.Query().Get("search")

	var bind *store.BindingTable
	if nodeID != "" {
		bind = &store.BindingTable{Table: "node_resource_bindings", IDCol: "node_id"}
	}
	rows, total, err := h.Service.List(r.Context(), tenantID, search, bind, nodeID, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询节点资源失败")
		return
	}
	items := make([]domain.NodeResource, 0, len(rows))
	for _, row := range rows {
		var res domain.NodeResource
		res.ID = row.ID
		res.NodeID = nodeID
		res.Name = row.Name
		res.Type = row.Type
		res.URL = row.URL
		if row.Size != "" {
			if n, err := parseInt(row.Size, 0); err == nil {
				res.Size = &n
			}
		}
		res.UploadedBy = row.UploadedBy
		res.UploadedAt = row.UploadedAt
		items = append(items, res)
	}
	respondJSON(w, http.StatusOK, NodeResourceListResponse{Items: items, Total: total})
}

func (h *NodeResourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req CreateNodeResourceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.NodeID == "" || req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var fileSize *int64
	if req.Size != nil {
		s := int64(*req.Size)
		fileSize = &s
	}

	row, err := h.Service.Create(r.Context(), tenantID, "node_resource_bindings", "node_id", req.NodeID, &store.ResourceCreateSimpleParams{
		Name:        req.Name,
		Type:        req.Type,
		URL:         req.URL,
		Description: req.Description,
		FileSize:    fileSize,
	}, nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建节点资源失败")
		return
	}
	var res domain.NodeResource
	res.ID = row.ID
	res.NodeID = req.NodeID
	res.Name = row.Name
	res.Type = row.Type
	res.URL = row.URL
	if row.Size != "" {
		if n, err := parseInt(row.Size, 0); err == nil {
			res.Size = &n
		}
	}
	respondJSON(w, http.StatusCreated, res)
}

func (h *NodeResourceHandler) BindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req BindNodeResourceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.NodeID == "" || req.ResourceID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id, err := h.Service.Bind(r.Context(), tenantID, "node_resource_bindings", "node_id", req.NodeID, req.ResourceID, nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "绑定节点资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *NodeResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.Service.Unbind(r.Context(), "node_resource_bindings", id, nil); err != nil {
		respondError(w, http.StatusInternalServerError, "解绑节点资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
