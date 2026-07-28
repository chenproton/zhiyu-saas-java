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

type ResourceLibraryHandler struct {
	DB *pgxpool.Pool
}

type ResourceLibraryListResponse struct {
	Items []domain.ResourceLibraryItem `json:"items"`
	Total int                          `json:"total"`
}

type CreateResourceLibraryRequest struct {
	Name         string              `json:"name"`
	ResourceType domain.ResourceType `json:"resourceType"`
	URL          *string             `json:"url"`
	Description  *string             `json:"description"`
	Thumbnail    *string             `json:"thumbnail"`
	FileSize     *int64              `json:"fileSize"`
	Metadata     domain.JSONMap      `json:"metadata"`
}

type UpdateResourceLibraryRequest struct {
	Name         *string              `json:"name"`
	ResourceType *domain.ResourceType `json:"resourceType"`
	URL          *string              `json:"url"`
	Description  *string              `json:"description"`
	Thumbnail    *string              `json:"thumbnail"`
	FileSize     *int64               `json:"fileSize"`
	Metadata     domain.JSONMap       `json:"metadata"`
}

const resourceSelectColumns = `
	rl.id, rl.tenant_id, rl.name, rl.resource_type, rl.url, rl.description,
	rl.thumbnail, rl.file_size, rl.metadata, rl.uploaded_by,
	u.name AS uploader_name, o.name AS uploader_org_name, m.name AS uploader_major_name,
	rl.created_at, rl.updated_at
`

const resourceJoinClause = `
	LEFT JOIN users u ON u.id = rl.uploaded_by
	LEFT JOIN organizations o ON o.id = u.org_node_id
	LEFT JOIN majors m ON m.id = u.major_id
`

func (h *ResourceLibraryHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	search := r.URL.Query().Get("search")
	resourceType := r.URL.Query().Get("resourceType")
	orgName := r.URL.Query().Get("orgName")
	majorName := r.URL.Query().Get("majorName")
	uploadedBy := r.URL.Query().Get("uploadedBy")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"rl.tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if search != "" {
		where = append(where, "(rl.name ILIKE $"+itoa(argIdx)+" OR rl.description ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if resourceType != "" {
		where = append(where, "rl.resource_type = $"+itoa(argIdx))
		args = append(args, resourceType)
		argIdx++
	}
	if orgName != "" {
		where = append(where, "o.name = $"+itoa(argIdx))
		args = append(args, orgName)
		argIdx++
	}
	if majorName != "" {
		where = append(where, "m.name = $"+itoa(argIdx))
		args = append(args, majorName)
		argIdx++
	}
	if uploadedBy != "" {
		where = append(where, "rl.uploaded_by = $"+itoa(argIdx))
		args = append(args, uploadedBy)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM resource_library rl " + resourceJoinClause + " WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT ` + resourceSelectColumns + `
		FROM resource_library rl
		` + resourceJoinClause + `
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY rl.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询资源失败")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取资源失败")
		return
	}

	respondJSON(w, http.StatusOK, ResourceLibraryListResponse{Items: items, Total: total})
}

func (h *ResourceLibraryHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源不存在")
		return
	}

	if !verifyTenantOwnership(w, r, item.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *ResourceLibraryHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateResourceLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Name == "" || req.ResourceType == "" {
		respondError(w, http.StatusBadRequest, "缺少名称或资源类型")
		return
	}

	claims := middleware.CurrentUser(r)
	uploadedBy := claims.UserID

	id := uuid.NewString()
	if req.Metadata == nil {
		req.Metadata = domain.JSONMap{}
	}
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, thumbnail, file_size, metadata, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, id, tenantID, req.Name, req.ResourceType, req.URL, req.Description, req.Thumbnail, req.FileSize, req.Metadata, uploadedBy)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建资源失败")
		return
	}

	item, _ := h.fetchItem(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *ResourceLibraryHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源不存在")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdateResourceLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	name := existing.Name
	resourceType := existing.ResourceType
	url := existing.URL
	description := existing.Description
	thumbnail := existing.Thumbnail
	fileSize := existing.FileSize
	metadata := existing.Metadata

	if req.Name != nil {
		name = *req.Name
	}
	if req.ResourceType != nil {
		resourceType = *req.ResourceType
	}
	if req.URL != nil {
		url = req.URL
	}
	if req.Description != nil {
		description = req.Description
	}
	if req.Thumbnail != nil {
		thumbnail = req.Thumbnail
	}
	if req.FileSize != nil {
		fileSize = req.FileSize
	}
	if req.Metadata != nil {
		metadata = req.Metadata
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE resource_library SET
			name = $1, resource_type = $2, url = $3, description = $4,
			thumbnail = $5, file_size = $6, metadata = $7, updated_at = NOW()
		WHERE id = $8
	`, name, resourceType, url, description, thumbnail, fileSize, metadata, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新资源失败")
		return
	}

	item, _ := h.fetchItem(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *ResourceLibraryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源不存在")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM resource_library WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ResourceLibraryHandler) fetchItem(ctx context.Context, id string) (domain.ResourceLibraryItem, error) {
	var item domain.ResourceLibraryItem
	var url, description, thumbnail *string
	var fileSize *int64
	var uploadedBy *string
	var uploaderName, uploaderOrgName, uploaderMajorName *string
	var metadata domain.JSONMap

	err := h.DB.QueryRow(ctx, `
		SELECT `+resourceSelectColumns+`
		FROM resource_library rl
		`+resourceJoinClause+`
		WHERE rl.id = $1
	`, id).Scan(
		&item.ID, &item.TenantID, &item.Name, &item.ResourceType,
		&url, &description, &thumbnail, &fileSize, &metadata,
		&uploadedBy, &uploaderName, &uploaderOrgName, &uploaderMajorName,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return item, err
	}
	item.URL = url
	item.Description = description
	item.Thumbnail = thumbnail
	item.FileSize = fileSize
	item.Metadata = metadata
	item.UploadedBy = uploadedBy
	item.UploaderName = uploaderName
	item.UploaderOrgName = uploaderOrgName
	item.UploaderMajorName = uploaderMajorName
	return item, nil
}

func (h *ResourceLibraryHandler) scanResourceRows(rows pgx.Rows) ([]domain.ResourceLibraryItem, error) {
	items := make([]domain.ResourceLibraryItem, 0)
	for rows.Next() {
		var item domain.ResourceLibraryItem
		var url, description, thumbnail *string
		var fileSize *int64
		var uploadedBy *string
		var uploaderName, uploaderOrgName, uploaderMajorName *string
		var metadata domain.JSONMap
		if err := rows.Scan(
			&item.ID, &item.TenantID, &item.Name, &item.ResourceType,
			&url, &description, &thumbnail, &fileSize, &metadata,
			&uploadedBy, &uploaderName, &uploaderOrgName, &uploaderMajorName,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.URL = url
		item.Description = description
		item.Thumbnail = thumbnail
		item.FileSize = fileSize
		item.Metadata = metadata
		item.UploadedBy = uploadedBy
		item.UploaderName = uploaderName
		item.UploaderOrgName = uploaderOrgName
		item.UploaderMajorName = uploaderMajorName
		items = append(items, item)
	}
	return items, nil
}
