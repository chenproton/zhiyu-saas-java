package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type PositionCloneHandler struct {
	DB *pgxpool.Pool
}

type ClonePositionRequest struct {
	Name string `json:"name"`
}

func (h *PositionCloneHandler) Clone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	src, err := h.fetchSourcePosition(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if src.TenantID != nil && *src.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "access denied")
		return
	}

	var req ClonePositionRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	newName := req.Name
	if newName == "" {
		newName = *src.Name + " (克隆)"
	}

	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	newID := uuid.NewString()
	_, err = tx.Exec(ctx, `
		INSERT INTO career_positions (id, tenant_id, batch_id, name, short_name, industry_id, position_type,
			salary_min, salary_max, cover_image, description, requirements, career_path,
			version, status, created_by, collaborators)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft', $15, $16)
	`, newID, tenantID, src.BatchID, newName, src.ShortName, src.IndustryID, src.PositionType,
		src.SalaryMin, src.SalaryMax, src.CoverImage, src.Description, src.Requirements,
		src.CareerPath, src.Version, claims.UserID, coalesceStringSlice(src.Collaborators))
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "岗位名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to clone position")
		return
	}

	if err := h.clonePositionMajors(ctx, tx, id, newID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clone position majors")
		return
	}

	respIDMap := make(map[string]string)
	if err := h.clonePositionResponsibilities(ctx, tx, id, newID, tenantID, respIDMap); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clone responsibilities")
		return
	}

	bindingIDMap := make(map[string]string)
	if err := h.clonePositionAbilityBindings(ctx, tx, id, newID, tenantID, respIDMap, bindingIDMap); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clone ability bindings")
		return
	}

	if err := h.cloneAbilityDomains(ctx, tx, id, newID, tenantID, bindingIDMap); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clone ability domains")
		return
	}

	if err := h.clonePositionCertificates(ctx, tx, id, newID, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clone certificates")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	handler := &PositionHandler{DB: h.DB}
	pos, _ := handler.fetchPosition(ctx, newID)
	respondJSON(w, http.StatusCreated, pos)
}

type sourcePositionFields struct {
	Name          *string
	ShortName     *string
	IndustryID    *string
	PositionType  string
	SalaryMin     *int
	SalaryMax     *int
	CoverImage    *string
	Description   *string
	Requirements  []string
	CareerPath    *string
	Version       string
	Collaborators []string
	BatchID       *string
	TenantID      *string
}

func (h *PositionCloneHandler) fetchSourcePosition(ctx context.Context, id string) (*sourcePositionFields, error) {
	var s sourcePositionFields
	var posType domain.PositionType
	err := h.DB.QueryRow(ctx, `
		SELECT name, short_name, industry_id, position_type, salary_min, salary_max,
			cover_image, description, requirements, career_path, version, collaborators, batch_id, tenant_id
		FROM career_positions WHERE id = $1
	`, id).Scan(&s.Name, &s.ShortName, &s.IndustryID, &posType,
		&s.SalaryMin, &s.SalaryMax, &s.CoverImage, &s.Description,
		&s.Requirements, &s.CareerPath, &s.Version, &s.Collaborators, &s.BatchID, &s.TenantID)
	if err != nil {
		return nil, err
	}
	s.PositionType = string(posType)
	return &s, nil
}

func (h *PositionCloneHandler) clonePositionMajors(ctx context.Context, tx pgx.Tx, oldPositionID, newPositionID string) error {
	rows, err := tx.Query(ctx, `
		SELECT major_id FROM career_position_majors WHERE career_position_id = $1
	`, oldPositionID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var majorID string
		if err := rows.Scan(&majorID); err != nil {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO career_position_majors (career_position_id, major_id) VALUES ($1, $2)
		`, newPositionID, majorID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *PositionCloneHandler) clonePositionResponsibilities(ctx context.Context, tx pgx.Tx, oldPositionID, newPositionID, tenantID string, respIDMap map[string]string) error {
	type respRow struct {
		OldID       string
		Name        string
		Description *string
		SortOrder   int
	}

	var rows2 []respRow
	r, err := tx.Query(ctx, `
		SELECT id, name, description, sort_order FROM position_responsibilities
		WHERE career_position_id = $1 ORDER BY sort_order
	`, oldPositionID)
	if err != nil {
		return nil
	}
	defer r.Close()
	for r.Next() {
		var rr respRow
		if err := r.Scan(&rr.OldID, &rr.Name, &rr.Description, &rr.SortOrder); err != nil {
			continue
		}
		rows2 = append(rows2, rr)
	}

	for _, rr := range rows2 {
		newRespID := uuid.NewString()
		respIDMap[rr.OldID] = newRespID
		_, err := tx.Exec(ctx, `
			INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, description, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, newRespID, tenantID, newPositionID, rr.Name, rr.Description, rr.SortOrder)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *PositionCloneHandler) clonePositionAbilityBindings(ctx context.Context, tx pgx.Tx, oldPositionID, newPositionID, tenantID string, respIDMap, bindingIDMap map[string]string) error {
	rows, err := tx.Query(ctx, `
		SELECT id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, attributes, weight
		FROM position_ability_bindings WHERE career_position_id = $1
	`, oldPositionID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var oldBindingID, oldRespID, abilityPointID, source string
		var domain, requiredLevel *string
		var rubricDescription *string
		var attributes []string
		var weight float64
		if err := rows.Scan(&oldBindingID, &oldRespID, &abilityPointID, &source,
			&domain, &requiredLevel, &rubricDescription, &attributes, &weight); err != nil {
			continue
		}

		newRespID, ok := respIDMap[oldRespID]
		if !ok {
			continue
		}

		newBindingID := uuid.NewString()
		bindingIDMap[oldBindingID] = newBindingID

		_, err := tx.Exec(ctx, `
			INSERT INTO position_ability_bindings (
				id, tenant_id, career_position_id, responsibility_id, ability_point_id, source,
				domain, required_level, rubric_description, attributes, weight
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, newBindingID, tenantID, newPositionID, newRespID, abilityPointID, source,
			domain, requiredLevel, rubricDescription, attributes, weight)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *PositionCloneHandler) cloneAbilityDomains(ctx context.Context, tx pgx.Tx, oldPositionID, newPositionID, tenantID string, bindingIDMap map[string]string) error {
	rows, err := tx.Query(ctx, `
		SELECT name, description, binding_ids, sort_order
		FROM ability_domains WHERE career_position_id = $1 ORDER BY sort_order
	`, oldPositionID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		var description *string
		var oldBindingIDs []string
		var sortOrder int
		if err := rows.Scan(&name, &description, &oldBindingIDs, &sortOrder); err != nil {
			continue
		}

		newBindingIDs := make([]string, 0, len(oldBindingIDs))
		for _, oldID := range oldBindingIDs {
			if newID, ok := bindingIDMap[oldID]; ok {
				newBindingIDs = append(newBindingIDs, newID)
			}
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.NewString(), tenantID, newPositionID, name, description, coalesceStringSlice(newBindingIDs), sortOrder)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *PositionCloneHandler) clonePositionCertificates(ctx context.Context, tx pgx.Tx, oldPositionID, newPositionID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT certificate_library_id FROM position_certificates WHERE career_position_id = $1
	`, oldPositionID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var libID string
		if err := rows.Scan(&libID); err != nil {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), tenantID, newPositionID, libID)
		if err != nil {
			return err
		}
	}
	return nil
}
