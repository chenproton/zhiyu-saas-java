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
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	courseID := r.URL.Query().Get("courseId")
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
	where = append(where, "rl.tenant_id = $"+itoa(argIdx))
	args = append(args, effectiveTenantID)
	argIdx++

	joinCourseBindings := ""
	if courseID != "" {
		joinCourseBindings = `JOIN course_resource_bindings crb ON crb.resource_id = rl.id AND crb.course_id = $` + itoa(argIdx)
		args = append(args, courseID)
		argIdx++
	} else {
		joinCourseBindings = `LEFT JOIN course_resource_bindings crb ON crb.resource_id = rl.id`
	}
	if search != "" {
		where = append(where, "(rl.name ILIKE $"+itoa(argIdx)+" OR rl.url ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := `
		SELECT COUNT(*) FROM resource_library rl
		` + joinCourseBindings + `
		WHERE ` + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT rl.id,
			COALESCE(crb.course_id::text, '') AS node_id,
			rl.name,
			rl.resource_type AS type,
			rl.url,
			rl.file_size::int AS size,
			rl.tenant_id,
			rl.created_at AS uploaded_at,
			rl.uploaded_by
		FROM resource_library rl
		` + joinCourseBindings + `
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY rl.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询课程资源失败")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取课程资源失败")
		return
	}

	respondJSON(w, http.StatusOK, CourseResourceListResponse{Items: items, Total: total})
}

func (h *CourseResourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req CreateCourseResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.CourseID == "" || req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	var fileSize *int64
	if req.Size != nil {
		s := int64(*req.Size)
		fileSize = &s
	}
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, file_size, uploaded_by)
		VALUES ($1, $2, $3, $4::resource_type, $5, $6, $7, $8)
	`, id, tenantID, req.Name, req.Type, req.URL, req.Description, fileSize, claims.UserID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建课程资源失败")
		return
	}

	_, _ = h.DB.Exec(r.Context(), `
		INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (course_id, resource_id) DO NOTHING
	`, uuid.NewString(), tenantID, req.CourseID, id)
	_, _ = h.DB.Exec(r.Context(), `
		UPDATE courses
		SET resource_ids = array_append(resource_ids, $2::uuid),
		    resource_count = COALESCE(array_length(array_append(resource_ids, $2::uuid), 1), 0)
		WHERE id = $1 AND NOT ($2::uuid = ANY(resource_ids))
	`, req.CourseID, id)

	resource, _ := h.fetchLibraryResource(r.Context(), id)
	if resource != nil {
		resource.NodeID = req.CourseID
		if req.Size != nil {
			resource.Size = req.Size
		}
	}
	respondJSON(w, http.StatusCreated, resource)
}

func (h *CourseResourceHandler) BindResource(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req BindCourseResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.CourseID == "" || req.ResourceID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
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
		respondError(w, http.StatusInternalServerError, "绑定课程资源失败")
		return
	}
	_, _ = h.DB.Exec(r.Context(), `
		UPDATE courses
		SET resource_ids = array_append(resource_ids, $2::uuid),
		    resource_count = COALESCE(array_length(array_append(resource_ids, $2::uuid), 1), 0)
		WHERE id = $1 AND NOT ($2::uuid = ANY(resource_ids))
	`, req.CourseID, req.ResourceID)

	binding, _ := h.fetchBinding(r.Context(), id)
	respondJSON(w, http.StatusOK, binding)
}

func (h *CourseResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	var courseID, resourceID string
	err := h.DB.QueryRow(r.Context(), `SELECT course_id, resource_id FROM course_resource_bindings WHERE id = $1`, id).Scan(&courseID, &resourceID)
	if err != nil {
		respondError(w, http.StatusNotFound, "绑定不存在")
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM course_resource_bindings WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "解绑课程资源失败")
		return
	}
	_, _ = h.DB.Exec(r.Context(), `
		UPDATE courses
		SET resource_ids = array_remove(resource_ids, $2::uuid),
		    resource_count = COALESCE(array_length(array_remove(resource_ids, $2::uuid), 1), 0)
		WHERE id = $1
	`, courseID, resourceID)

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

func (h *CourseResourceHandler) fetchLibraryResource(ctx context.Context, id string) (*domain.NodeResource, error) {
	var res domain.NodeResource
	var tenantID *string
	var uploadedBy *string
	var fileSize *int64
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, resource_type, url, file_size, tenant_id, uploaded_by, created_at
		FROM resource_library WHERE id = $1
	`, id).Scan(
		&res.ID, &res.Name, &res.Type, &res.URL, &fileSize, &tenantID, &uploadedBy, &res.UploadedAt,
	)
	if err != nil {
		return nil, err
	}
	res.UploadedBy = uploadedBy
	if fileSize != nil {
		s := int(*fileSize)
		res.Size = &s
	}
	return &res, nil
}

func (h *CourseResourceHandler) scanResourceRows(rows pgx.Rows) ([]domain.NodeResource, error) {
	items := make([]domain.NodeResource, 0)
	for rows.Next() {
		var res domain.NodeResource
		var tenantID *string
		var uploadedBy *string
		var fileSize *int64
		if err := rows.Scan(&res.ID, &res.NodeID, &res.Name, &res.Type, &res.URL, &fileSize, &tenantID, &res.UploadedAt, &uploadedBy); err != nil {
			return nil, err
		}
		res.UploadedBy = uploadedBy
		if fileSize != nil {
			s := int(*fileSize)
			res.Size = &s
		}
		items = append(items, res)
	}
	return items, nil
}
