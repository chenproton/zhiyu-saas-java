package handler

import (
	"context"
	"encoding/json"
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
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	courseID := r.URL.Query().Get("courseId")
	nodeID := r.URL.Query().Get("nodeId")
	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 200
	offset := 0
	if v, err := parseInt(limitStr, 200); err == nil && v > 0 {
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
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	// node_resources 自身不一定有 tenant_id，通过 system_course_nodes 进行租户隔离
	where = append(where, "EXISTS (SELECT 1 FROM system_course_nodes n WHERE n.id = nr.node_id AND n.tenant_id = $"+itoa(argIdx)+")")
	args = append(args, effectiveTenantID)
	argIdx++

	if courseID != "" {
		where = append(where, "EXISTS (SELECT 1 FROM system_course_nodes n WHERE n.id = nr.node_id AND n.course_id = $"+itoa(argIdx)+")")
		args = append(args, courseID)
		argIdx++
	}
	if nodeID != "" {
		where = append(where, "nr.node_id = $"+itoa(argIdx))
		args = append(args, nodeID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(nr.name ILIKE $"+itoa(argIdx)+" OR nr.url ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM node_resources nr WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT nr.id, nr.node_id, nr.name, nr.type, nr.url, nr.size, nr.tenant_id, nr.created_at
		FROM node_resources nr
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY nr.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list node resources")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan node resources")
		return
	}

	respondJSON(w, http.StatusOK, NodeResourceListResponse{Items: items, Total: total})
}

func (h *NodeResourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req CreateNodeResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.NodeID == "" || req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO node_resources (id, tenant_id, node_id, name, type, url, size)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, tenantID, req.NodeID, req.Name, req.Type, req.URL, req.Size)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create node resource")
		return
	}

	resource, _ := h.fetchResource(r.Context(), id)
	respondJSON(w, http.StatusCreated, resource)
}

func (h *NodeResourceHandler) BindResource(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req BindNodeResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.NodeID == "" || req.ResourceID == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
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
		respondError(w, http.StatusInternalServerError, "failed to bind node resource")
		return
	}

	binding, _ := h.fetchBinding(r.Context(), id)
	respondJSON(w, http.StatusOK, binding)
}

func (h *NodeResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `DELETE FROM node_resource_bindings WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to unbind node resource")
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
	err := h.DB.QueryRow(ctx, `
		SELECT id, node_id, name, type, url, size, tenant_id, created_at
		FROM node_resources WHERE id = $1
	`, id).Scan(
		&res.ID, &res.NodeID, &res.Name, &res.Type, &res.URL, &res.Size, &tenantID, &res.UploadedAt,
	)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (h *NodeResourceHandler) scanResourceRows(rows pgx.Rows) ([]domain.NodeResource, error) {
	items := make([]domain.NodeResource, 0)
	for rows.Next() {
		var res domain.NodeResource
		var tenantID *string
		if err := rows.Scan(&res.ID, &res.NodeID, &res.Name, &res.Type, &res.URL, &res.Size, &tenantID, &res.UploadedAt); err != nil {
			return nil, err
		}
		items = append(items, res)
	}
	return items, nil
}
