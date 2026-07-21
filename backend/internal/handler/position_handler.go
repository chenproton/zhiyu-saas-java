package handler

import (
	"context"
	"encoding/json"
	"log"
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
	claims := middleware.CurrentUser(r)
	publicOnly := claims == nil

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

	if publicOnly {
		// Anonymous public view only sees published positions across all tenants.
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, string(domain.StatusPublished))
		argIdx++
	} else {
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
		} else {
			where = append(where, "status != $"+itoa(argIdx))
			args = append(args, "archived")
			argIdx++
		}
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
			cp.collaborators,
			(SELECT COUNT(*) FROM position_favorites pf WHERE pf.career_position_id = cp.id) AS favorite_count,
			cp.created_at, cp.updated_at
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
	claims := middleware.CurrentUser(r)
	publicOnly := claims == nil

	id := chi.URLParam(r, "id")
	pos, err := h.fetchPosition(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}
	if publicOnly && pos.Status != domain.StatusPublished {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

func (h *PositionHandler) PublicList(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "请先登录")
		return
	}

	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}

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

	where := []string{"cp.status = $1", "cp.tenant_id = $2"}
	args := []interface{}{string(domain.StatusPublished), tenantID}
	argIdx := 3

	if positionType != "" {
		where = append(where, "cp.position_type = $"+itoa(argIdx))
		args = append(args, positionType)
		argIdx++
	}
	if search != "" {
		where = append(where, "cp.name ILIKE $"+itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM career_positions cp WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT cp.id, cp.batch_id, cp.name, cp.short_name, cp.industry_id,
			COALESCE((SELECT array_agg(cpm.major_id) FROM career_position_majors cpm WHERE cpm.career_position_id = cp.id), '{}') AS major_ids,
			COALESCE((SELECT array_agg(m.name) FROM career_position_majors cpm JOIN majors m ON m.id = cpm.major_id WHERE cpm.career_position_id = cp.id), '{}') AS major_names,
			cp.position_type, cp.salary_min, cp.salary_max, cp.cover_image, cp.description,
			cp.requirements, cp.career_path, cp.version, cp.status, cp.created_by,
			cp.collaborators,
			(SELECT COUNT(*) FROM position_favorites pf WHERE pf.career_position_id = cp.id) AS favorite_count,
			cp.created_at, cp.updated_at
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

func (h *PositionHandler) PublicGet(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "请先登录")
		return
	}

	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}

	id := chi.URLParam(r, "id")

	var posTenantID string
	err := h.DB.QueryRow(r.Context(), `SELECT tenant_id FROM career_positions WHERE id = $1`, id).Scan(&posTenantID)
	if err != nil || posTenantID != tenantID {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}

	pos, err := h.fetchPosition(r.Context(), id)
	if err != nil || pos.Status != domain.StatusPublished {
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
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "岗位名称已存在，请使用其他名称")
			return
		}
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

	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.PositionType == "" {
		req.PositionType = string(existing.PositionType)
	}
	if req.ShortName == nil || *req.ShortName == "" {
		req.ShortName = existing.ShortName
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
	batchID := req.BatchID
	industryID := req.IndustryID
	if industryID == nil {
		industryID = existing.IndustryID
	}
	salaryMin := req.SalaryMin
	if salaryMin == nil {
		salaryMin = existing.SalaryMin
	}
	salaryMax := req.SalaryMax
	if salaryMax == nil {
		salaryMax = existing.SalaryMax
	}
	coverImage := req.CoverImage
	if coverImage == nil {
		coverImage = existing.CoverImage
	}
	description := req.Description
	if description == nil {
		description = existing.Description
	}
	careerPath := req.CareerPath
	if careerPath == nil {
		careerPath = existing.CareerPath
	}
	version := req.Version
	if version == "" {
		version = existing.Version
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
	`, batchID, req.Name, req.ShortName, industryID, req.PositionType,
		salaryMin, salaryMax, coverImage, description, requirements,
		careerPath, version, collaborators, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "岗位名称已存在，请使用其他名称")
			return
		}
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

type FullPositionResponsibility struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

type FullPositionCertificate struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	Image       *string `json:"image"`
}

type FullPositionAbilityBinding struct {
	ID                string   `json:"id"`
	ResponsibilityID  string   `json:"responsibilityId"`
	Source            string   `json:"source"`
	PublicAbilityID   *string  `json:"publicAbilityId"`
	AbilityPointID    *string  `json:"abilityPointId"`
	Name              string   `json:"name"`
	Category          string   `json:"category"`
	Level             string   `json:"level"`
	RubricDescription *string  `json:"rubricDescription"`
	Description       *string  `json:"description"`
	Attributes        []string `json:"attributes"`
	Domain            *string  `json:"domain"`
}

type FullPositionAbilityDomain struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	BindingIDs  []string `json:"bindingIds"`
}

type SaveFullPositionRequest struct {
	BatchID        string                        `json:"batchId"`
	Name           string                        `json:"name"`
	ShortName      string                        `json:"shortName"`
	Industry       string                        `json:"industry"`
	Majors         []string                      `json:"majors"`
	PositionType   string                        `json:"positionType"`
	SalaryRange    [2]int                        `json:"salaryRange"`
	CoverImage     *string                       `json:"coverImage"`
	Description    *string                       `json:"description"`
	Requirements   []string                      `json:"requirements"`
	CareerPath     *string                       `json:"careerPath"`
	Version        string                        `json:"version"`
	Collaborators  []string                      `json:"collaborators"`
	Responsibilities []FullPositionResponsibility `json:"responsibilities"`
	Certificates   []FullPositionCertificate     `json:"certificates"`
	AbilityBindings []FullPositionAbilityBinding `json:"abilityBindings"`
	AbilityDomains []FullPositionAbilityDomain   `json:"abilityDomains"`
}

type SaveFullPositionResponse struct {
	Position domain.CareerPosition `json:"position"`
}

func (h *PositionHandler) actions() contentActions {
	return contentActions{
		db:         h.DB,
		table:      "career_positions",
		entityName: "position",
		targetType: "career_position",
		inviteCol:  "collaborators",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.fetchPosition(ctx, id)
		},
	}
}

func (h *PositionHandler) SaveFull(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchPosition(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}

	var req SaveFullPositionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	var batchID *string
	if req.BatchID != "" {
		batchID = &req.BatchID
	}
	var industryID *string
	if req.Industry != "" {
		industryID = &req.Industry
	}
	var coverImage, description, careerPath *string
	if req.CoverImage != nil && *req.CoverImage != "" {
		coverImage = req.CoverImage
	}
	if req.Description != nil && *req.Description != "" {
		description = req.Description
	}
	if req.CareerPath != nil && *req.CareerPath != "" {
		careerPath = req.CareerPath
	}

	reqBody, _ := json.Marshal(req)
	tenantID := ""
	if claims.TenantID != nil {
		tenantID = *claims.TenantID
	}
	log.Printf("[SaveFull] id=%s tenant=%s req=%s", id, tenantID, string(reqBody))

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		log.Printf("[SaveFull] begin tx failed: %v", err)
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
	`, batchID, req.Name, strPtr(req.ShortName), industryID, req.PositionType,
		req.SalaryRange[0], req.SalaryRange[1], coverImage, description,
		coalesceStringSlice(req.Requirements), careerPath, req.Version,
		coalesceStringSlice(req.Collaborators), id)
	if err != nil {
		log.Printf("[SaveFull] update career_positions failed: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to update position")
		return
	}

	_, err = tx.Exec(r.Context(), `DELETE FROM career_position_majors WHERE career_position_id = $1`, id)
	if err != nil {
		log.Printf("[SaveFull] delete career_position_majors failed: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to update position majors")
		return
	}
	for _, majorID := range req.Majors {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO career_position_majors (career_position_id, major_id) VALUES ($1, $2)
		`, id, majorID)
		if err != nil {
			log.Printf("[SaveFull] insert career_position_majors failed majorID=%s: %v", majorID, err)
			respondError(w, http.StatusInternalServerError, "failed to insert position majors")
			return
		}
	}

	_, err = tx.Exec(r.Context(), `DELETE FROM position_certificates WHERE career_position_id = $1`, id)
	if err != nil {
		log.Printf("[SaveFull] delete position_certificates failed: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to clear certificates")
		return
	}
	_, err = tx.Exec(r.Context(), `DELETE FROM ability_domains WHERE career_position_id = $1`, id)
	if err != nil {
		log.Printf("[SaveFull] delete ability_domains failed: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to clear ability domains")
		return
	}
	_, err = tx.Exec(r.Context(), `DELETE FROM position_ability_bindings WHERE career_position_id = $1`, id)
	if err != nil {
		log.Printf("[SaveFull] delete position_ability_bindings failed: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to clear ability bindings")
		return
	}
	_, err = tx.Exec(r.Context(), `DELETE FROM position_responsibilities WHERE career_position_id = $1`, id)
	if err != nil {
		log.Printf("[SaveFull] delete position_responsibilities failed: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to clear responsibilities")
		return
	}

	respIDMap := make(map[string]string)
	for idx, resp := range req.Responsibilities {
		if resp.Name == "" {
			continue
		}
		respID := uuid.NewString()
		var desc *string
		if resp.Description != nil && *resp.Description != "" {
			desc = resp.Description
		}
		_, err = tx.Exec(r.Context(), `
			INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, description, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, respID, claims.TenantID, id, resp.Name, desc, idx)
		if err != nil {
			log.Printf("[SaveFull] insert position_responsibilities failed: %v", err)
			respondError(w, http.StatusInternalServerError, "failed to create responsibility")
			return
		}
		respIDMap[resp.ID] = respID
	}

	abilityPointMap := make(map[string]string)
	abilityNameMap := make(map[string]string)
	bindingIDMap := make(map[string]string)
	for _, binding := range req.AbilityBindings {
		if binding.Source == "public" && binding.PublicAbilityID != nil && *binding.PublicAbilityID != "" {
			abilityPointMap[binding.ID] = *binding.PublicAbilityID
		}
	}

	for _, binding := range req.AbilityBindings {
		if binding.Source != "public" && binding.Source != "custom" {
			continue
		}
		respBackendID, ok := respIDMap[binding.ResponsibilityID]
		if !ok {
			continue
		}

		abilityPointID, exists := abilityPointMap[binding.ID]
		if !exists {
			if binding.AbilityPointID != nil && *binding.AbilityPointID != "" {
				abilityPointID = *binding.AbilityPointID
			} else {
				// Cache by name within this request so multiple bindings referencing the
				// same ability point do not attempt duplicate inserts or queries.
				if cachedID, ok := abilityNameMap[binding.Name]; ok {
					abilityPointID = cachedID
				} else {
					category := mapCategory(binding.Category)
					attrArray := coalesceStringSlice(binding.Attributes)

					// Reuse existing ability point with the same name in this tenant to avoid
					// violating the uq_ability_points_tenant_name unique constraint.
					var existingAbilityID string
					err = tx.QueryRow(r.Context(), `
						SELECT id FROM ability_points WHERE tenant_id = $1 AND name = $2
					`, claims.TenantID, binding.Name).Scan(&existingAbilityID)
					if err == nil {
						abilityPointID = existingAbilityID
						log.Printf("[SaveFull] reused existing ability_point id=%s name=%s", abilityPointID, binding.Name)
					} else {
						abilityPointID = uuid.NewString()
						_, err = tx.Exec(r.Context(), `
							INSERT INTO ability_points (id, tenant_id, name, description, category, attributes, is_public)
							VALUES ($1, $2, $3, $4, $5, $6, $7)
						`, abilityPointID, claims.TenantID, binding.Name, binding.Description, category, attrArray, false)
						if err != nil {
							log.Printf("[SaveFull] insert ability_points failed: %v", err)
							respondError(w, http.StatusInternalServerError, "failed to create ability point")
							return
						}
					}
					abilityNameMap[binding.Name] = abilityPointID
				}
			}
			abilityPointMap[binding.ID] = abilityPointID
		}

		bindingID := uuid.NewString()
		var domainField, rubricDesc *string
		if binding.Domain != nil && *binding.Domain != "" {
			domainField = binding.Domain
		}
		if binding.RubricDescription != nil && *binding.RubricDescription != "" {
			rubricDesc = binding.RubricDescription
		}
		_, err = tx.Exec(r.Context(), `
			INSERT INTO position_ability_bindings (
				id, tenant_id, career_position_id, responsibility_id, ability_point_id, source,
				domain, required_level, rubric_description, attributes, weight
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (career_position_id, responsibility_id, ability_point_id) DO UPDATE SET
				domain = EXCLUDED.domain,
				required_level = EXCLUDED.required_level,
				rubric_description = EXCLUDED.rubric_description,
				attributes = EXCLUDED.attributes
		`, bindingID, claims.TenantID, id, respBackendID, abilityPointID, binding.Source,
			domainField, binding.Level, rubricDesc, coalesceStringSlice(binding.Attributes), 0)
		if err != nil {
			log.Printf("[SaveFull] insert position_ability_bindings failed: %v", err)
			respondError(w, http.StatusInternalServerError, "failed to create ability binding")
			return
		}
		bindingIDMap[binding.ID] = bindingID
	}

	for idx, d := range req.AbilityDomains {
		if d.Name == "" {
			continue
		}
		bindingIDs := make([]string, 0, len(d.BindingIDs))
		for _, localID := range d.BindingIDs {
			if backendID, ok := bindingIDMap[localID]; ok {
				bindingIDs = append(bindingIDs, backendID)
			}
		}
		var desc *string
		if d.Description != nil && *d.Description != "" {
			desc = d.Description
		}
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.NewString(), claims.TenantID, id, d.Name, desc, coalesceStringSlice(bindingIDs), idx)
		if err != nil {
			log.Printf("[SaveFull] insert ability_domains failed: %v", err)
			respondError(w, http.StatusInternalServerError, "failed to create ability domain")
			return
		}
	}

	for _, cert := range req.Certificates {
		if cert.Name == "" {
			continue
		}
		// Find or create certificate in library
		var libraryID string
		err = tx.QueryRow(r.Context(), `
			SELECT id FROM certificate_library WHERE tenant_id = $1 AND name = $2
		`, claims.TenantID, cert.Name).Scan(&libraryID)
		if err != nil {
			libraryID = uuid.NewString()
			_, err = tx.Exec(r.Context(), `
				INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, libraryID, claims.TenantID, cert.Name, cert.URL, cert.Description, cert.Image)
			if err != nil {
				log.Printf("[SaveFull] insert certificate_library failed: %v", err)
				respondError(w, http.StatusInternalServerError, "failed to create certificate in library")
				return
			}
		}
		_, err = tx.Exec(r.Context(), `
			INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), claims.TenantID, id, libraryID)
		if err != nil {
			log.Printf("[SaveFull] insert position_certificates failed: %v", err)
			respondError(w, http.StatusInternalServerError, "failed to create certificate")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		log.Printf("[SaveFull] commit failed: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	log.Printf("[SaveFull] id=%s saved successfully", id)

	pos, _ := h.fetchPosition(r.Context(), id)
	respondJSON(w, http.StatusOK, SaveFullPositionResponse{Position: pos})
}

type FavoriteStatusResponse struct {
	IsFavorite    bool `json:"isFavorite"`
	FavoriteCount int  `json:"favoriteCount"`
}

func (h *PositionHandler) GetFavorite(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchPosition(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}

	var count int
	_ = h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM position_favorites WHERE career_position_id = $1`, id).Scan(&count)

	var isFavorite bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM position_favorites WHERE user_id = $1 AND career_position_id = $2)`, claims.UserID, id).Scan(&isFavorite)

	respondJSON(w, http.StatusOK, FavoriteStatusResponse{IsFavorite: isFavorite, FavoriteCount: count})
}

func (h *PositionHandler) ToggleFavorite(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchPosition(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "position not found")
		return
	}

	ctx := r.Context()
	var exists bool
	_ = h.DB.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM position_favorites WHERE user_id = $1 AND career_position_id = $2)
	`, claims.UserID, id).Scan(&exists)

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	if exists {
		_, err = tx.Exec(ctx, `
			DELETE FROM position_favorites WHERE user_id = $1 AND career_position_id = $2
		`, claims.UserID, id)
	} else {
		_, err = tx.Exec(ctx, `
			INSERT INTO position_favorites (user_id, career_position_id) VALUES ($1, $2)
		`, claims.UserID, id)
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to toggle favorite")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	var count int
	_ = h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM position_favorites WHERE career_position_id = $1
	`, id).Scan(&count)

	respondJSON(w, http.StatusOK, FavoriteStatusResponse{IsFavorite: !exists, FavoriteCount: count})
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func mapCategory(category string) string {
	switch category {
	case "知识":
		return "knowledge"
	case "素养":
		return "quality"
	case "技能", "专业技能":
		return "skill"
	default:
		return "skill"
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

func (h *PositionHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *PositionHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
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
			cp.collaborators,
			(SELECT COUNT(*) FROM position_favorites pf WHERE pf.career_position_id = cp.id) AS favorite_count,
			cp.created_at, cp.updated_at
		FROM career_positions cp WHERE cp.id = $1
	`, id).Scan(
		&p.ID, &batchID, &p.Name, &shortName, &industryID, &majorIDs, &majorNames, &p.PositionType,
		&salaryMin, &salaryMax, &coverImage, &description, &requirements, &careerPath,
		&p.Version, &p.Status, &p.CreatedBy, &collaborators, &p.FavoriteCount,
		&p.CreatedAt, &p.UpdatedAt,
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
			&p.Version, &p.Status, &p.CreatedBy, &collaborators, &p.FavoriteCount,
			&p.CreatedAt, &p.UpdatedAt,
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
