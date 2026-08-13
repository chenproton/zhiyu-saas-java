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

	limit, offset := parseLimitOffset(r, 200)
	nodeID := r.URL.Query().Get("nodeId")
	search := r.URL.Query().Get("search")

	var bind *store.BindingTable
	if nodeID != "" {
		bind = &store.BindingTable{Table: "node_resource_bindings", IDCol: "node_id"}
	}
	rows, total, err := h.Service.List(r.Context(), tenantID, search, bind, nodeID, limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询节点资源失败")
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
	respondJSON(w, http.StatusOK, ListResponse[domain.NodeResource]{Items: items, Total: total})
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
	// 校验目标节点属于当前租户（防止把资源绑定到他租户节点）
	if !h.checkNodeTenant(w, r, req.NodeID) {
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
		respondServerError(w, r, err, "创建节点资源失败")
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
	// 校验目标节点租户归属
	if !h.checkNodeTenant(w, r, req.NodeID) {
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
		respondServerError(w, r, err, "绑定节点资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// checkNodeTenant 校验节点属于当前租户（节点→课程→租户链路）。
func (h *NodeResourceHandler) checkNodeTenant(w http.ResponseWriter, r *http.Request, nodeID string) bool {
	courseID, err := h.Service.NodeCourseID(r.Context(), nodeID)
	if err != nil {
		respondError(w, http.StatusNotFound, "节点不存在")
		return false
	}
	courseTenantID, err := h.Service.CourseTenantID(r.Context(), courseID)
	if err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return false
	}
	return verifyTenantOwnership(w, r, courseTenantID)
}

func (h *NodeResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	nodeID, err := h.Service.BindTargetID(r.Context(), "node_resource_bindings", id)
	if err != nil {
		respondJSON(w, http.StatusOK, map[string]string{"id": id})
		return
	}
	courseID, err := h.Service.NodeCourseID(r.Context(), nodeID)
	if err != nil {
		respondError(w, http.StatusNotFound, "节点不存在")
		return
	}
	courseTenantID, err := h.Service.CourseTenantID(r.Context(), courseID)
	if err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}
	if !verifyTenantOwnership(w, r, courseTenantID) {
		return
	}
	if err := h.Service.Unbind(r.Context(), "node_resource_bindings", id, nil); err != nil {
		respondServerError(w, r, err, "解绑节点资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
