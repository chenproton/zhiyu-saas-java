package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type NodeResourceHandler struct {
	DB *pgxpool.Pool
}

type NodeResourceListResponse struct {
	Items []domain.NodeResource `json:"items"`
	Total int                   `json:"total"`
}

type NodeResourceBindingListResponse struct {
	Items []domain.NodeResourceBinding `json:"items"`
	Total int                          `json:"total"`
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

	courseID := r.URL.Query().Get("courseId")
	nodeID := r.URL.Query().Get("nodeId")
	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 200
	offset := 0
	if v, err := parsePageLimit(limitStr, 200); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	where = append(where, "EXISTS (SELECT 1 FROM system_course_nodes n WHERE n.id = nrb.node_id AND n.tenant_id = $"+itoa(argIdx)+")")
	args = append(args, effectiveTenantID)
	argIdx++

	if courseID != "" {
		where = append(where, "EXISTS (SELECT 1 FROM system_course_nodes n WHERE n.id = nrb.node_id AND n.course_id = $"+itoa(argIdx)+")")
		args = append(args, courseID)
		argIdx++
	}
	if nodeID != "" {
		where = append(where, "nrb.node_id = $"+itoa(argIdx))
		args = append(args, nodeID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(rl.name ILIKE $"+itoa(argIdx)+" OR rl.url ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := `
		SELECT COUNT(*) FROM node_resource_bindings nrb
		JOIN resource_library rl ON rl.id = nrb.resource_id
		WHERE ` + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT rl.id, nrb.node_id, rl.name, rl.resource_type, rl.url,
			rl.file_size::int, rl.tenant_id, rl.created_at
		FROM node_resource_bindings nrb
		JOIN resource_library rl ON rl.id = nrb.resource_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY rl.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询节点资源失败")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取节点资源失败")
		return
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

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, file_size)
		VALUES ($1, $2, $3, $4::resource_type, $5, $6, $7)
	`, id, tenantID, req.Name, req.Type, req.URL, req.Description, fileSize)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建节点资源失败")
		return
	}

	_, _ = h.DB.Exec(r.Context(), `
		INSERT INTO node_resource_bindings (id, tenant_id, node_id, resource_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (node_id, resource_id) DO NOTHING
	`, uuid.NewString(), tenantID, req.NodeID, id)

	resource, _ := h.fetchResource(r.Context(), id)
	if resource != nil {
		resource.NodeID = req.NodeID
	}
	respondJSON(w, http.StatusCreated, resource)
}

func (h *NodeResourceHandler) BindResource(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
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

	var id string
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO node_resource_bindings (tenant_id, node_id, resource_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (node_id, resource_id) DO UPDATE SET node_id = EXCLUDED.node_id
		RETURNING id
	`, tenantID, req.NodeID, req.ResourceID).Scan(&id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "绑定节点资源失败")
		return
	}

	binding, _ := h.fetchBinding(r.Context(), id)
	respondJSON(w, http.StatusOK, binding)
}

func (h *NodeResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `DELETE FROM node_resource_bindings WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "解绑节点资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *NodeResourceHandler) fetchBinding(ctx context.Context, id string) (*domain.NodeResourceBinding, error) {
	var b domain.NodeResourceBinding
	err := h.DB.QueryRow(ctx, `SELECT id, node_id, resource_id FROM node_resource_bindings WHERE id = $1`, id).Scan(
		&b.ID, &b.NodeID, &b.ResourceID,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (h *NodeResourceHandler) fetchResource(ctx context.Context, id string) (*domain.NodeResource, error) {
	var res domain.NodeResource
	var tenantID *string
	var fileSize *int64
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, resource_type, url, file_size, tenant_id, created_at
		FROM resource_library WHERE id = $1
	`, id).Scan(
		&res.ID, &res.Name, &res.Type, &res.URL, &fileSize, &tenantID, &res.UploadedAt,
	)
	if err != nil {
		return nil, err
	}
	if fileSize != nil {
		s := int(*fileSize)
		res.Size = &s
	}
	return &res, nil
}

func (h *NodeResourceHandler) scanResourceRows(rows pgx.Rows) ([]domain.NodeResource, error) {
	items := make([]domain.NodeResource, 0)
	for rows.Next() {
		var res domain.NodeResource
		var tenantID *string
		var fileSize *int64
		if err := rows.Scan(&res.ID, &res.NodeID, &res.Name, &res.Type, &res.URL, &fileSize, &tenantID, &res.UploadedAt); err != nil {
			return nil, err
		}
		if fileSize != nil {
			s := int(*fileSize)
			res.Size = &s
		}
		items = append(items, res)
	}
	return items, nil
}
