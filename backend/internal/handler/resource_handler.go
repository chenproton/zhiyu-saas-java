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

type ResourceHandler struct {
	DB *pgxpool.Pool
}

type ResourceListResponse struct {
	Items []domain.Resource `json:"items"`
	Total int               `json:"total"`
}

type CreateResourceRequest struct {
	Name           string             `json:"name"`
	Intro          string             `json:"intro"`
	Category       string             `json:"category"`
	CoverImage     *string            `json:"coverImage"`
	Attachment     *string            `json:"attachment"`
	AttachmentName *string            `json:"attachmentName"`
	Price          float64            `json:"price"`
	Version        string             `json:"version"`
	Tags           []ResourceTagInput `json:"tags"`
}

type ResourceTagInput struct {
	TagType  string `json:"tagType"`
	TagValue string `json:"tagValue"`
}

type ReviewResourceRequest struct {
	Status       string  `json:"status"`
	RejectReason *string `json:"rejectReason"`
}

func (h *ResourceHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	status := r.URL.Query().Get("status")
	category := r.URL.Query().Get("category")
	institutionID := r.URL.Query().Get("institutionId")
	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		where = append(where, "r.status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if category != "" {
		where = append(where, "r.category = $"+itoa(argIdx))
		args = append(args, category)
		argIdx++
	}
	if institutionID != "" {
		where = append(where, "r.institution_id = $"+itoa(argIdx))
		args = append(args, institutionID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(r.name ILIKE $"+itoa(argIdx)+" OR r.intro ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	// Non-operators (or anonymous users) can only see published resources or their own
	if claims == nil || !platformAdminOnly(claims) {
		if claims != nil && claims.InstitutionID != nil {
			where = append(where, "(r.status = $"+itoa(argIdx)+" OR r.institution_id = $"+itoa(argIdx+1)+")")
			args = append(args, domain.ResourceStatusPublished, *claims.InstitutionID)
			argIdx += 2
		} else {
			where = append(where, "r.status = $"+itoa(argIdx))
			args = append(args, domain.ResourceStatusPublished)
			argIdx++
		}
	}

	countQuery := "SELECT COUNT(*) FROM resources r WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT r.id, r.institution_id, r.name, r.intro, r.category, r.cover_image, r.attachment, r.attachment_name,
			r.price, r.version, r.status, r.reject_reason, r.sales_count,
			(SELECT COUNT(*) FROM view_logs WHERE target_type = 'resource' AND target_id = r.id) AS view_count,
			r.created_at, r.updated_at
		FROM resources r
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY r.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list resources")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceRows(r.Context(), rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan resources")
		return
	}

	respondJSON(w, http.StatusOK, ResourceListResponse{Items: items, Total: total})
}

func (h *ResourceHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, err := h.fetchResource(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "resource not found")
		return
	}
	respondJSON(w, http.StatusOK, res)
}

func (h *ResourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if platformAdminOnly(claims) {
		respondError(w, http.StatusForbidden, "operator cannot create resources")
		return
	}
	if claims.InstitutionID == nil {
		respondError(w, http.StatusForbidden, "user not associated with an institution")
		return
	}

	var req CreateResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.Category == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	id := uuid.NewString()
	if req.Version == "" {
		req.Version = "v1.0"
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		INSERT INTO resources (id, institution_id, name, intro, category, cover_image, attachment, attachment_name,
			price, version, status, sales_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', 0)
	`, id, *claims.InstitutionID, req.Name, req.Intro, req.Category, req.CoverImage, req.Attachment, req.AttachmentName,
		req.Price, req.Version)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create resource")
		return
	}

	if err := h.replaceResourceTags(r.Context(), tx, id, req.Tags); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save tags")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	res, _ := h.fetchResource(r.Context(), id)
	respondJSON(w, http.StatusCreated, res)
}

func (h *ResourceHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	id := chi.URLParam(r, "id")

	existing, err := h.fetchResource(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "resource not found")
		return
	}

	if !platformAdminOnly(claims) && (claims.InstitutionID == nil || *claims.InstitutionID != existing.InstitutionID) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		UPDATE resources SET name = $1, intro = $2, category = $3, cover_image = $4, attachment = $5, attachment_name = $6,
			price = $7, version = $8, updated_at = NOW()
		WHERE id = $9
	`, req.Name, req.Intro, req.Category, req.CoverImage, req.Attachment, req.AttachmentName,
		req.Price, req.Version, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update resource")
		return
	}

	if req.Tags != nil {
		if err := h.replaceResourceTags(r.Context(), tx, id, req.Tags); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to save tags")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	res, _ := h.fetchResource(r.Context(), id)
	respondJSON(w, http.StatusOK, res)
}

func (h *ResourceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	id := chi.URLParam(r, "id")

	existing, err := h.fetchResource(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "resource not found")
		return
	}

	if !platformAdminOnly(claims) && (claims.InstitutionID == nil || *claims.InstitutionID != existing.InstitutionID) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var refCount int
	if err := h.DB.QueryRow(r.Context(), `
		SELECT (SELECT COUNT(*) FROM orders WHERE resource_id = $1)
		     + (SELECT COUNT(*) FROM authorizations WHERE resource_id = $1)`, id).Scan(&refCount); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to check resource references")
		return
	}
	if refCount > 0 {
		respondError(w, http.StatusConflict, "资源存在订单或授权记录，不可删除，请改为下架")
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM resources WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete resource")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ResourceHandler) SubmitForReview(w http.ResponseWriter, r *http.Request) {
	h.transitionStatus(w, r, "reviewing", "")
}

func (h *ResourceHandler) Review(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !platformAdminOnly(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	var req ReviewResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var status domain.ResourceStatus
	var rejectReason *string
	switch req.Status {
	case "pending_publish":
		status = domain.ResourceStatusPendingPublish
	case "rejected":
		status = domain.ResourceStatusRejected
		rejectReason = req.RejectReason
	default:
		respondError(w, http.StatusBadRequest, "invalid review status")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE resources SET status = $1, reject_reason = $2, updated_at = NOW() WHERE id = $3
	`, status, rejectReason, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to review resource")
		return
	}

	res, _ := h.fetchResource(r.Context(), id)
	respondJSON(w, http.StatusOK, res)
}

func (h *ResourceHandler) Publish(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !platformAdminOnly(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	h.transitionStatus(w, r, "published", "")
}

func (h *ResourceHandler) Offline(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !platformAdminOnly(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	h.transitionStatus(w, r, "offlined", "")
}

func (h *ResourceHandler) transitionStatus(w http.ResponseWriter, r *http.Request, status string, rejectReason string) {
	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `
		UPDATE resources SET status = $1, reject_reason = $2, updated_at = NOW() WHERE id = $3
	`, status, rejectReason, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	res, _ := h.fetchResource(r.Context(), id)
	respondJSON(w, http.StatusOK, res)
}

func (h *ResourceHandler) IncrementView(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := middleware.CurrentUser(r)

	var userID, tenantID any
	if claims != nil {
		userID = claims.UserID
		tenantID = claims.TenantID
	} else {
		userID = nil
		tenantID = nil
	}

	_, err := h.DB.Exec(r.Context(), `INSERT INTO view_logs (target_type, target_id, user_id, tenant_id) VALUES ('resource', $1, $2, $3)`, id, userID, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to increment view")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ResourceHandler) fetchResource(ctx context.Context, id string) (*domain.Resource, error) {
	var res domain.Resource
	err := h.DB.QueryRow(ctx, `
		SELECT id, institution_id, name, intro, category, cover_image, attachment, attachment_name,
			price, version, status, reject_reason, sales_count,
			(SELECT COUNT(*) FROM view_logs WHERE target_type = 'resource' AND target_id = id) AS view_count,
			created_at, updated_at
		FROM resources WHERE id = $1
	`, id).Scan(
		&res.ID, &res.InstitutionID, &res.Name, &res.Intro, &res.Category, &res.CoverImage, &res.Attachment,
		&res.AttachmentName, &res.Price, &res.Version, &res.Status, &res.RejectReason, &res.SalesCount,
		&res.ViewCount, &res.CreatedAt, &res.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	res.Tags, _ = h.fetchResourceTags(ctx, res.ID)
	return &res, nil
}

func (h *ResourceHandler) fetchResourceTags(ctx context.Context, resourceID string) ([]domain.ResourceTag, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT id, resource_id, tag_type, tag_value FROM resource_tags WHERE resource_id = $1 ORDER BY tag_type, tag_value
	`, resourceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := make([]domain.ResourceTag, 0)
	for rows.Next() {
		var t domain.ResourceTag
		if err := rows.Scan(&t.ID, &t.ResourceID, &t.TagType, &t.TagValue); err == nil {
			tags = append(tags, t)
		}
	}
	return tags, nil
}

func (h *ResourceHandler) replaceResourceTags(ctx context.Context, tx pgx.Tx, resourceID string, tags []ResourceTagInput) error {
	_, err := tx.Exec(ctx, `DELETE FROM resource_tags WHERE resource_id = $1`, resourceID)
	if err != nil {
		return err
	}
	for _, tag := range tags {
		if tag.TagType == "" || tag.TagValue == "" {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO resource_tags (id, resource_id, tag_type, tag_value)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), resourceID, tag.TagType, tag.TagValue)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ResourceHandler) scanResourceRows(ctx context.Context, rows pgx.Rows) ([]domain.Resource, error) {
	items := make([]domain.Resource, 0)
	for rows.Next() {
		var res domain.Resource
		if err := rows.Scan(
			&res.ID, &res.InstitutionID, &res.Name, &res.Intro, &res.Category, &res.CoverImage, &res.Attachment,
			&res.AttachmentName, &res.Price, &res.Version, &res.Status, &res.RejectReason, &res.SalesCount,
			&res.ViewCount, &res.CreatedAt, &res.UpdatedAt,
		); err != nil {
			return nil, err
		}
		res.Tags, _ = h.fetchResourceTags(ctx, res.ID)
		items = append(items, res)
	}
	return items, nil
}
