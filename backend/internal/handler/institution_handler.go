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

type InstitutionHandler struct {
	DB *pgxpool.Pool
}

type InstitutionListResponse struct {
	Items []domain.Institution `json:"items"`
	Total int                  `json:"total"`
}

type CreateInstitutionRequest struct {
	Type              string   `json:"type"`
	Name              string   `json:"name"`
	CreditCode        string   `json:"creditCode"`
	Logo              *string  `json:"logo"`
	Intro             string   `json:"intro"`
	ContactName       string   `json:"contactName"`
	ContactPhone      string   `json:"contactPhone"`
	ContactEmail      string   `json:"contactEmail"`
	QualificationFile *string  `json:"qualificationFile"`
	ExpertiseTags     []string `json:"expertiseTags"`
	OrgCode           string   `json:"orgCode"`
}

type UpdateInstitutionRequest struct {
	Name              string   `json:"name"`
	Logo              *string  `json:"logo"`
	Intro             string   `json:"intro"`
	ContactName       string   `json:"contactName"`
	ContactPhone      string   `json:"contactPhone"`
	ContactEmail      string   `json:"contactEmail"`
	QualificationFile *string  `json:"qualificationFile"`
	ExpertiseTags     []string `json:"expertiseTags"`
}

func (h *InstitutionHandler) List(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	instType := r.URL.Query().Get("type")
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
	institutionClaims := middleware.CurrentUser(r)
	filterInstitutionID, ok := institutionFilter(institutionClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing institution")
		return
	}
	if filterInstitutionID != "" {
		where = append(where, "id = $"+itoa(argIdx))
		args = append(args, filterInstitutionID)
		argIdx++
	}

	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if instType != "" {
		where = append(where, "type = $"+itoa(argIdx))
		args = append(args, instType)
		argIdx++
	}
	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR org_code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM institutions WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := "SELECT id, type, name, credit_code, logo, intro, contact_name, contact_phone, contact_email, qualification_file, status, org_code, balance, total_spent, total_income, created_at, updated_at FROM institutions WHERE " + strings.Join(where, " AND ") + " ORDER BY created_at DESC LIMIT $" + itoa(argIdx) + " OFFSET $" + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list institutions")
		return
	}
	defer rows.Close()

	items, err := h.scanInstitutionRows(r.Context(), rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan institutions")
		return
	}

	respondJSON(w, http.StatusOK, InstitutionListResponse{Items: items, Total: total})
}

func (h *InstitutionHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	inst, err := h.fetchInstitution(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "institution not found")
		return
	}
	respondJSON(w, http.StatusOK, inst)
}

func (h *InstitutionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateInstitutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Type != "school" && req.Type != "enterprise" {
		respondError(w, http.StatusBadRequest, "invalid institution type")
		return
	}
	if req.Name == "" || req.CreditCode == "" || req.OrgCode == "" || req.ContactName == "" || req.ContactPhone == "" || req.ContactEmail == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	id := uuid.NewString()

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		INSERT INTO institutions (id, type, name, credit_code, logo, intro, contact_name, contact_phone, contact_email,
			qualification_file, status, org_code, balance, total_spent, total_income)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, 0, 0, 0)
	`, id, req.Type, req.Name, req.CreditCode, req.Logo, req.Intro, req.ContactName, req.ContactPhone, req.ContactEmail,
		req.QualificationFile, req.OrgCode)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create institution")
		return
	}

	if err := h.replaceInstitutionTags(r.Context(), tx, id, req.ExpertiseTags); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save tags")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	inst, _ := h.fetchInstitution(r.Context(), id)
	respondJSON(w, http.StatusCreated, inst)
}

func (h *InstitutionHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	id := chi.URLParam(r, "id")

	if !platformAdminOnly(claims) && (claims.InstitutionID == nil || *claims.InstitutionID != id) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req UpdateInstitutionRequest
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
		UPDATE institutions SET name = $1, logo = $2, intro = $3, contact_name = $4, contact_phone = $5,
			contact_email = $6, qualification_file = $7, updated_at = NOW()
		WHERE id = $8
	`, req.Name, req.Logo, req.Intro, req.ContactName, req.ContactPhone, req.ContactEmail, req.QualificationFile, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update institution")
		return
	}

	if req.ExpertiseTags != nil {
		if err := h.replaceInstitutionTags(r.Context(), tx, id, req.ExpertiseTags); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to save tags")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	inst, _ := h.fetchInstitution(r.Context(), id)
	respondJSON(w, http.StatusOK, inst)
}

func (h *InstitutionHandler) UpdateStatus(w http.ResponseWriter, r *http.Request, status domain.InstitutionStatus) {
	claims := middleware.CurrentUser(r)
	if !platformAdminOnly(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `UPDATE institutions SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	inst, _ := h.fetchInstitution(r.Context(), id)
	respondJSON(w, http.StatusOK, inst)
}

func (h *InstitutionHandler) Approve(w http.ResponseWriter, r *http.Request) {
	h.UpdateStatus(w, r, domain.InstitutionStatusApproved)
}

func (h *InstitutionHandler) Disable(w http.ResponseWriter, r *http.Request) {
	h.UpdateStatus(w, r, domain.InstitutionStatusDisabled)
}

func (h *InstitutionHandler) fetchInstitution(ctx context.Context, id string) (*domain.Institution, error) {
	var inst domain.Institution
	err := h.DB.QueryRow(ctx, `
		SELECT id, type, name, credit_code, logo, intro, contact_name, contact_phone, contact_email,
			qualification_file, status, org_code, balance, total_spent, total_income, created_at, updated_at
		FROM institutions WHERE id = $1
	`, id).Scan(
		&inst.ID, &inst.Type, &inst.Name, &inst.CreditCode, &inst.Logo, &inst.Intro,
		&inst.ContactName, &inst.ContactPhone, &inst.ContactEmail, &inst.QualificationFile,
		&inst.Status, &inst.OrgCode, &inst.Balance, &inst.TotalSpent, &inst.TotalIncome,
		&inst.CreatedAt, &inst.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	inst.ExpertiseTags, _ = h.fetchInstitutionTags(ctx, inst.ID)
	return &inst, nil
}

func (h *InstitutionHandler) fetchInstitutionTags(ctx context.Context, institutionID string) ([]string, error) {
	rows, err := h.DB.Query(ctx, `SELECT tag_value FROM institution_expertise_tags WHERE institution_id = $1 ORDER BY tag_value`, institutionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := make([]string, 0)
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil {
			tags = append(tags, t)
		}
	}
	return tags, nil
}

func (h *InstitutionHandler) replaceInstitutionTags(ctx context.Context, tx pgx.Tx, institutionID string, tags []string) error {
	_, err := tx.Exec(ctx, `DELETE FROM institution_expertise_tags WHERE institution_id = $1`, institutionID)
	if err != nil {
		return err
	}
	for _, tag := range tags {
		if tag == "" {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO institution_expertise_tags (id, institution_id, tag_value)
			VALUES ($1, $2, $3) ON CONFLICT (institution_id, tag_value) DO NOTHING
		`, uuid.NewString(), institutionID, tag)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *InstitutionHandler) scanInstitutionRows(ctx context.Context, rows pgx.Rows) ([]domain.Institution, error) {
	items := make([]domain.Institution, 0)
	for rows.Next() {
		var inst domain.Institution
		if err := rows.Scan(
			&inst.ID, &inst.Type, &inst.Name, &inst.CreditCode, &inst.Logo, &inst.Intro,
			&inst.ContactName, &inst.ContactPhone, &inst.ContactEmail, &inst.QualificationFile,
			&inst.Status, &inst.OrgCode, &inst.Balance, &inst.TotalSpent, &inst.TotalIncome,
			&inst.CreatedAt, &inst.UpdatedAt,
		); err != nil {
			return nil, err
		}
		inst.ExpertiseTags, _ = h.fetchInstitutionTags(ctx, inst.ID)
		items = append(items, inst)
	}
	return items, nil
}
