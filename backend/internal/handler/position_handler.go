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

type PositionHandler struct {
	DB *pgxpool.Pool
}

type PositionListResponse struct {
	Items []domain.CareerPosition `json:"items"`
	Total int                     `json:"total"`
}

type CreatePositionRequest struct {
	BatchID       *string  `json:"batchId"`
	Name          string   `json:"name"`
	ShortName     *string  `json:"shortName"`
	IndustryID    *string  `json:"industryId"`
	MajorIDs      []string `json:"majorIds"`
	PositionType  string   `json:"positionType"`
	SalaryMin     *int     `json:"salaryMin"`
	SalaryMax     *int     `json:"salaryMax"`
	CoverImage    *string  `json:"coverImage"`
	Description   *string  `json:"description"`
	Requirements  []string `json:"requirements"`
	CareerPath    *string  `json:"careerPath"`
	Version       string   `json:"version"`
	Collaborators []string `json:"collaborators"`
}

type UpdatePositionRequest struct {
	BatchID       *string  `json:"batchId"`
	Name          string   `json:"name"`
	ShortName     *string  `json:"shortName"`
	IndustryID    *string  `json:"industryId"`
	MajorIDs      []string `json:"majorIds"`
	PositionType  string   `json:"positionType"`
	SalaryMin     *int     `json:"salaryMin"`
	SalaryMax     *int     `json:"salaryMax"`
	CoverImage    *string  `json:"coverImage"`
	Description   *string  `json:"description"`
	Requirements  []string `json:"requirements"`
	CareerPath    *string  `json:"careerPath"`
	Version       string   `json:"version"`
	Collaborators []string `json:"collaborators"`
}

func (h *PositionHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	batchID := r.URL.Query().Get("batchId")
	status := r.URL.Query().Get("status")
	positionType := r.URL.Query().Get("positionType")
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
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if batchID != "" {
		where = append(where, "batch_id = $"+itoa(argIdx))
		args = append(args, batchID)
		argIdx++
	}
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if positionType != "" {
		where = append(where, "position_type = $"+itoa(argIdx))
		args = append(args, positionType)
		argIdx++
	}
	if search != "" {
		where = append(where, "name ILIKE $"+itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM career_positions WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT cp.id, cp.batch_id, cp.name, cp.short_name, cp.industry_id,
			COALESCE((SELECT array_agg(cpm.major_id) FROM career_position_majors cpm WHERE cpm.career_position_id = cp.id), '{}') AS major_ids,
			COALESCE((SELECT array_agg(m.name) FROM career_position_majors cpm JOIN majors m ON m.id = cpm.major_id WHERE cpm.career_position_id = cp.id), '{}') AS major_names,
			cp.position_type, cp.salary_min, cp.salary_max, cp.cover_image, cp.description,
			cp.requirements, cp.career_path, cp.version, cp.status, cp.created_by,
			cp.collaborators, cp.created_at, cp.updated_at
		FROM career_positions cp
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY cp.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list positions")
		return
	}
	defer rows.Close()

	items, err := h.scanPositionRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan positions")
		return
	}

	respondJSON(w, http.StatusOK, PositionListResponse{Items: items, Total: total})
}

func (h *PositionHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	pos, err := h.fetchPosition(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

func (h *PositionHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreatePositionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}
	if req.Version == "" {
		req.Version = "v1.0"
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	status := domain.CareerPositionStatusDraft

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		INSERT INTO career_positions (
			id, tenant_id, batch_id, name, short_name, industry_id, position_type,
			salary_min, salary_max, cover_image, description, requirements, career_path,
			version, status, created_by, collaborators
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`, id, tenantID, req.BatchID, req.Name, req.ShortName, req.IndustryID,
		req.PositionType, req.SalaryMin, req.SalaryMax, req.CoverImage, req.Description,
		coalesceStringSlice(req.Requirements), req.CareerPath, req.Version, status, claims.UserID,
		coalesceStringSlice(req.Collaborators))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create position")
		return
	}

	for _, majorID := range req.MajorIDs {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO career_position_majors (career_position_id, major_id) VALUES ($1, $2)
		`, id, majorID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to insert position majors")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	pos, _ := h.fetchPosition(r.Context(), id)
	respondJSON(w, http.StatusCreated, pos)
}

func (h *PositionHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchPosition(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}

	var req UpdatePositionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	majorIDs := req.MajorIDs
	if majorIDs == nil {
		majorIDs = existing.MajorIDs
	}
	requirements := req.Requirements
	if requirements == nil {
		requirements = existing.Requirements
	}
	collaborators := req.Collaborators
	if collaborators == nil {
		collaborators = existing.Collaborators
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
		UPDATE career_positions SET
			batch_id = $1, name = $2, short_name = $3, industry_id = $4,
			position_type = $5, salary_min = $6, salary_max = $7, cover_image = $8,
			description = $9, requirements = $10, career_path = $11, version = $12,
			collaborators = $13, updated_at = NOW()
		WHERE id = $14
	`, req.BatchID, req.Name, req.ShortName, req.IndustryID, req.PositionType,
		req.SalaryMin, req.SalaryMax, req.CoverImage, req.Description, requirements,
		req.CareerPath, req.Version, collaborators, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update position")
		return
	}

	_, err = tx.Exec(r.Context(), `DELETE FROM career_position_majors WHERE career_position_id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update position majors")
		return
	}

	for _, majorID := range majorIDs {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO career_position_majors (career_position_id, major_id) VALUES ($1, $2)
		`, id, majorID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to insert position majors")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	pos, _ := h.fetchPosition(r.Context(), id)
	respondJSON(w, http.StatusOK, pos)
}

func (h *PositionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchPosition(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM career_positions WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete position")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *PositionHandler) actions() contentActions {
	return contentActions{
		db:         h.DB,
		table:      "career_positions",
		entityName: "position",
		inviteCol:  "collaborators",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.fetchPosition(ctx, id)
		},
	}
}

func (h *PositionHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *PositionHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *PositionHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

func (h *PositionHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *PositionHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPublished)
}

func (h *PositionHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *PositionHandler) fetchPosition(ctx context.Context, id string) (domain.CareerPosition, error) {
	var p domain.CareerPosition
	var batchID, shortName, industryID, coverImage, description, careerPath *string
	var salaryMin, salaryMax *int
	var majorIDs, majorNames, requirements, collaborators []string

	err := h.DB.QueryRow(ctx, `
		SELECT cp.id, cp.batch_id, cp.name, cp.short_name, cp.industry_id,
			COALESCE((SELECT array_agg(cpm.major_id) FROM career_position_majors cpm WHERE cpm.career_position_id = cp.id), '{}') AS major_ids,
			COALESCE((SELECT array_agg(m.name) FROM career_position_majors cpm JOIN majors m ON m.id = cpm.major_id WHERE cpm.career_position_id = cp.id), '{}') AS major_names,
			cp.position_type, cp.salary_min, cp.salary_max, cp.cover_image, cp.description,
			cp.requirements, cp.career_path, cp.version, cp.status, cp.created_by,
			cp.collaborators, cp.created_at, cp.updated_at
		FROM career_positions cp WHERE cp.id = $1
	`, id).Scan(
		&p.ID, &batchID, &p.Name, &shortName, &industryID, &majorIDs, &majorNames, &p.PositionType,
		&salaryMin, &salaryMax, &coverImage, &description, &requirements, &careerPath,
		&p.Version, &p.Status, &p.CreatedBy, &collaborators, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return p, err
	}
	p.BatchID = batchID
	p.ShortName = shortName
	p.IndustryID = industryID
	p.MajorIDs = majorIDs
	p.MajorNames = majorNames
	p.SalaryMin = salaryMin
	p.SalaryMax = salaryMax
	p.CoverImage = coverImage
	p.Description = description
	p.Requirements = requirements
	p.CareerPath = careerPath
	p.Collaborators = collaborators
	return p, nil
}

func (h *PositionHandler) scanPositionRows(rows pgx.Rows) ([]domain.CareerPosition, error) {
	items := make([]domain.CareerPosition, 0)
	for rows.Next() {
		var p domain.CareerPosition
		var batchID, shortName, industryID, coverImage, description, careerPath *string
		var salaryMin, salaryMax *int
		var majorIDs, majorNames, requirements, collaborators []string

		if err := rows.Scan(
			&p.ID, &batchID, &p.Name, &shortName, &industryID, &majorIDs, &majorNames, &p.PositionType,
			&salaryMin, &salaryMax, &coverImage, &description, &requirements, &careerPath,
			&p.Version, &p.Status, &p.CreatedBy, &collaborators, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		p.BatchID = batchID
		p.ShortName = shortName
		p.IndustryID = industryID
		p.MajorIDs = majorIDs
		p.MajorNames = majorNames
		p.SalaryMin = salaryMin
		p.SalaryMax = salaryMax
		p.CoverImage = coverImage
		p.Description = description
		p.Requirements = requirements
		p.CareerPath = careerPath
		p.Collaborators = collaborators
		items = append(items, p)
	}
	return items, nil
}

func coalesceStringSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
