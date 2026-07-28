package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type MicroCertHandler struct {
	DB *pgxpool.Pool
}

type MicroCertTemplateListResponse struct {
	Items []domain.MicroCertTemplate `json:"items"`
	Total int                        `json:"total"`
}

type CreateMicroCertTemplateRequest struct {
	Title        string  `json:"title"`
	CertTypeID   string  `json:"certTypeId"`
	CertTypeName string  `json:"certTypeName"`
	Content      string  `json:"content"`
	CoverImage   *string `json:"coverImage"`
}

type IssueCertsRequest struct {
	TemplateID string   `json:"templateId"`
	UserIDs    []string `json:"userIds"`
}

type CertIssuanceListResponse struct {
	Items []domain.CertIssuanceRecord `json:"items"`
	Total int                         `json:"total"`
}

func (h *MicroCertHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
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
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}
	if search != "" {
		where = append(where, "title ILIKE $"+itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM micro_cert_templates WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, title, cert_type_id, cert_type_name, content, cover_image, created_at, updated_at
		FROM micro_cert_templates
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询微证书模板失败")
		return
	}
	defer rows.Close()

	items, err := h.scanTemplateRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取微证书模板失败")
		return
	}

	respondJSON(w, http.StatusOK, MicroCertTemplateListResponse{Items: items, Total: total})
}

func (h *MicroCertHandler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateMicroCertTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Title == "" || req.CertTypeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	id := uuid.NewString()
	certTypeUUID, err := uuid.Parse(req.CertTypeID)
	if err != nil {
		certTypeUUID = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(req.CertTypeID))
	}
	_, err = h.DB.Exec(r.Context(), `
		INSERT INTO micro_cert_templates (id, tenant_id, title, cert_type_id, cert_type_name, content, cover_image)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, tenantID, req.Title, certTypeUUID.String(), req.CertTypeName, req.Content, req.CoverImage)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建微证书模板失败")
		return
	}

	template, _ := h.fetchTemplate(r.Context(), id)
	respondJSON(w, http.StatusCreated, template)
}

func (h *MicroCertHandler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchTemplate(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "微证书模板不存在")
		return
	}

	var req CreateMicroCertTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Title == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	certTypeUUID, err := uuid.Parse(req.CertTypeID)
	if err != nil {
		certTypeUUID = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(req.CertTypeID))
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE micro_cert_templates SET title = $1, cert_type_id = $2, cert_type_name = $3, content = $4, cover_image = $5, updated_at = NOW()
		WHERE id = $6
	`, req.Title, certTypeUUID.String(), req.CertTypeName, req.Content, req.CoverImage, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新微证书模板失败")
		return
	}

	template, _ := h.fetchTemplate(r.Context(), id)
	respondJSON(w, http.StatusOK, template)
}

func (h *MicroCertHandler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchTemplate(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "微证书模板不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM cert_issuance_records WHERE template_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除相关发放记录失败")
		return
	}
	_, err = h.DB.Exec(r.Context(), `DELETE FROM micro_cert_templates WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除微证书模板失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *MicroCertHandler) IssueCerts(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req IssueCertsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.TemplateID == "" || len(req.UserIDs) == 0 {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	tenantID, ok := requireTenant(w, r); if !ok { return }

	count := 0
	for _, userID := range req.UserIDs {
		recordID := uuid.NewString()
		_, err := tx.Exec(r.Context(), `
			INSERT INTO cert_issuance_records (id, tenant_id, template_id, user_id, issue_date, status, cert_number)
			VALUES ($1, $2, $3, $4, $5, 'issued', $6)
		`, recordID, tenantID, req.TemplateID, userID, time.Now(), uuid.NewString())
		if err != nil {
			respondError(w, http.StatusInternalServerError, "发放certs失败")
			return
		}
		count++
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]int{"count": count})
}

func (h *MicroCertHandler) ListHistory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	templateID := r.URL.Query().Get("templateId")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	if templateID != "" {
		where = append(where, "template_id = $"+itoa(argIdx))
		args = append(args, templateID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM cert_issuance_records WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, template_id, user_id, cert_number, issue_date,
			expire_date, status, revoked_at, revoke_reason
		FROM cert_issuance_records
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY issue_date DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询证书发放记录失败")
		return
	}
	defer rows.Close()

	items := make([]domain.CertIssuanceRecord, 0)
	for rows.Next() {
		var record domain.CertIssuanceRecord
		var expireDate, revokedAt *time.Time
		var revokeReason *string
		if err := rows.Scan(&record.ID, &record.TemplateID, &record.UserID, &record.CertNumber, &record.IssueDate,
			&expireDate, &record.Status, &revokedAt, &revokeReason); err != nil {
			respondError(w, http.StatusInternalServerError, "读取证书发放记录失败")
			return
		}
		record.ExpireDate = expireDate
		record.RevokedAt = revokedAt
		record.RevokeReason = revokeReason
		items = append(items, record)
	}
	respondJSON(w, http.StatusOK, CertIssuanceListResponse{Items: items, Total: total})
}

func (h *MicroCertHandler) fetchTemplate(ctx context.Context, id string) (domain.MicroCertTemplate, error) {
	var t domain.MicroCertTemplate
	var coverImage *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, title, cert_type_id, cert_type_name, content, cover_image, created_at, updated_at
		FROM micro_cert_templates WHERE id = $1
	`, id).Scan(&t.ID, &t.Title, &t.CertTypeID, &t.CertTypeName, &t.Content, &coverImage, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return t, err
	}
	t.CoverImage = coverImage
	return t, nil
}

func (h *MicroCertHandler) scanTemplateRows(rows pgx.Rows) ([]domain.MicroCertTemplate, error) {
	items := make([]domain.MicroCertTemplate, 0)
	for rows.Next() {
		var t domain.MicroCertTemplate
		var coverImage *string
		if err := rows.Scan(&t.ID, &t.Title, &t.CertTypeID, &t.CertTypeName, &t.Content, &coverImage, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.CoverImage = coverImage
		items = append(items, t)
	}
	return items, nil
}
