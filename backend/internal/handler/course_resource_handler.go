package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CourseResourceHandler struct {
	DB *pgxpool.Pool
}

type CourseResourceListResponse struct {
	Items []domain.NodeResource `json:"items"`
	Total int                   `json:"total"`
}

type CreateCourseResourceRequest struct {
	CourseID    string  `json:"courseId"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	Size        *int    `json:"size"`
}

type BindCourseResourceRequest struct {
	CourseID   string `json:"courseId"`
	ResourceID string `json:"resourceId"`
}

func (h *CourseResourceHandler) ListResources(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	courseID := r.URL.Query().Get("courseId")
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
	where = append(where, "crb.tenant_id = $"+itoa(argIdx))
	args = append(args, effectiveTenantID)
	argIdx++

	if courseID != "" {
		where = append(where, "crb.course_id = $"+itoa(argIdx))
		args = append(args, courseID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(COALESCE(nr.name, tr.name) ILIKE $"+itoa(argIdx)+" OR COALESCE(nr.url, tr.url) ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM course_resource_bindings crb WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT COALESCE(nr.id, tr.id) AS id,
			crb.course_id AS node_id,
			COALESCE(nr.name, tr.name) AS name,
			COALESCE(nr.type, tr.type) AS type,
			COALESCE(nr.url, tr.url) AS url,
			nr.size AS size,
			COALESCE(nr.tenant_id, tr.tenant_id) AS tenant_id,
			COALESCE(nr.created_at, tr.uploaded_at) AS uploaded_at,
			tr.uploaded_by AS uploaded_by
		FROM course_resource_bindings crb
		LEFT JOIN node_resources nr ON nr.id = crb.resource_id
		LEFT JOIN task_resources tr ON tr.id = crb.resource_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY crb.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list course resources")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan course resources")
		return
	}

	respondJSON(w, http.StatusOK, CourseResourceListResponse{Items: items, Total: total})
}

func (h *CourseResourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req CreateCourseResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.CourseID == "" || req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO task_resources (id, tenant_id, name, type, url, description, size, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7::varchar, $8)
	`, id, tenantID, req.Name, req.Type, req.URL, req.Description, intPtrToString(req.Size), claims.UserID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create course resource")
		return
	}

	_, _ = h.DB.Exec(r.Context(), `
		INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (course_id, resource_id) DO NOTHING
	`, uuid.NewString(), tenantID, req.CourseID, id)

	resource, _ := h.fetchTaskResource(r.Context(), id)
	if resource != nil {
		resource.NodeID = req.CourseID
		resource.Size = req.Size
	}
	respondJSON(w, http.StatusCreated, resource)
}

func (h *CourseResourceHandler) BindResource(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req BindCourseResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.CourseID == "" || req.ResourceID == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var id string
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO course_resource_bindings (tenant_id, course_id, resource_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (course_id, resource_id) DO UPDATE SET course_id = EXCLUDED.course_id
		RETURNING id
	`, tenantID, req.CourseID, req.ResourceID).Scan(&id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to bind course resource")
		return
	}

	binding, _ := h.fetchBinding(r.Context(), id)
	respondJSON(w, http.StatusOK, binding)
}

func (h *CourseResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `DELETE FROM course_resource_bindings WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to unbind course resource")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CourseResourceHandler) fetchBinding(ctx context.Context, id string) (*domain.CourseResourceBinding, error) {
	var b domain.CourseResourceBinding
	err := h.DB.QueryRow(ctx, `SELECT id, course_id, resource_id FROM course_resource_bindings WHERE id = $1`, id).Scan(
		&b.ID, &b.CourseID, &b.ResourceID,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (h *CourseResourceHandler) fetchTaskResource(ctx context.Context, id string) (*domain.NodeResource, error) {
	var res domain.NodeResource
	var tenantID *string
	var uploadedBy *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, type, url, tenant_id, uploaded_by, uploaded_at
		FROM task_resources WHERE id = $1
	`, id).Scan(
		&res.ID, &res.Name, &res.Type, &res.URL, &tenantID, &uploadedBy, &res.UploadedAt,
	)
	if err != nil {
		return nil, err
	}
	res.UploadedBy = uploadedBy
	return &res, nil
}

func (h *CourseResourceHandler) scanResourceRows(rows pgx.Rows) ([]domain.NodeResource, error) {
	items := make([]domain.NodeResource, 0)
	for rows.Next() {
		var res domain.NodeResource
		var tenantID *string
		var uploadedBy *string
		if err := rows.Scan(&res.ID, &res.NodeID, &res.Name, &res.Type, &res.URL, &res.Size, &tenantID, &res.UploadedAt, &uploadedBy); err != nil {
			return nil, err
		}
		res.UploadedBy = uploadedBy
		items = append(items, res)
	}
	return items, nil
}

func intPtrToString(v *int) *string {
	if v == nil {
		return nil
	}
	s := fmt.Sprintf("%d", *v)
	return &s
}
