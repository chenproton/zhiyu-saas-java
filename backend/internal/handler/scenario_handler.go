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

type ScenarioHandler struct {
	DB *pgxpool.Pool
}

type ScenarioListResponse struct {
	Items []domain.Scenario `json:"items"`
	Total int               `json:"total"`
}

type CreateScenarioRequest struct {
	Name             string   `json:"name"`
	Code             string   `json:"code"`
	CoverImage       *string  `json:"coverImage"`
	CareerPositionID *string  `json:"careerPositionId"`
	IndustryID       *string  `json:"industryId"`
	ProfessionID     *string  `json:"professionId"`
	ProfessionName   *string  `json:"professionName"`
	BatchID          *string  `json:"batchId"`
	Difficulty       int      `json:"difficulty"`
	Version          string   `json:"version"`
	Background       *string  `json:"background"`
	DeliveryGoal     *string  `json:"deliveryGoal"`
	CoBuilderIDs     []string `json:"coBuilderIds"`
}

func (h *ScenarioHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	status := r.URL.Query().Get("status")
	batchID := r.URL.Query().Get("batchId")
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
		where = append(where, "s.tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if batchID != "" {
		where = append(where, "batch_id = $"+itoa(argIdx))
		args = append(args, batchID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM scenarios s WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT s.id, s.name, s.code, s.cover_image, s.career_position_id, s.industry_id, COALESCE(i.name, '') AS industry_name,
			s.profession_id, s.profession_name, s.batch_id, s.difficulty, s.version, s.status, s.background,
			s.delivery_goal, s.creator_id, s.co_builder_ids, s.tenant_id, s.created_at, s.updated_at, s.publish_time,
			(SELECT COUNT(*) FROM view_logs WHERE target_type = 'scenario' AND target_id = s.id) AS view_count
		FROM scenarios s
		LEFT JOIN industries i ON i.id = s.industry_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY s.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list scenarios")
		return
	}
	defer rows.Close()

	items, err := h.scanScenarioRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan scenarios")
		return
	}

	respondJSON(w, http.StatusOK, ScenarioListResponse{Items: items, Total: total})
}

func (h *ScenarioHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	scenario, err := h.fetchScenario(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "scenario not found")
		return
	}
	respondJSON(w, http.StatusOK, scenario)
}

func (h *ScenarioHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateScenarioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.Code == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}
	if req.Version == "" {
		req.Version = "v1.0"
	}

	id := uuid.NewString()

	var tenantID *string
	if claims.TenantID != nil && *claims.TenantID != "" {
		tenantID = claims.TenantID
	}

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO scenarios (id, name, code, cover_image, career_position_id, industry_id,
			profession_id, profession_name, batch_id, difficulty, version, status, background,
			delivery_goal, creator_id, co_builder_ids, tenant_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12, $13, $14, $15, $16)
	`, id, req.Name, req.Code, req.CoverImage, req.CareerPositionID, req.IndustryID,
		req.ProfessionID, req.ProfessionName, req.BatchID, req.Difficulty, req.Version, req.Background,
		req.DeliveryGoal, claims.UserID, coalesceStringSlice(req.CoBuilderIDs), tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create scenario")
		return
	}

	scenario, _ := h.fetchScenario(r.Context(), id)
	respondJSON(w, http.StatusCreated, scenario)
}

func (h *ScenarioHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchScenario(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "scenario not found")
		return
	}

	var req CreateScenarioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	coBuilderIDs := req.CoBuilderIDs
	if coBuilderIDs == nil {
		coBuilderIDs = existing.CoBuilderIDs
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE scenarios SET name = $1, code = $2, cover_image = $3, career_position_id = $4,
			industry_id = $5, profession_id = $6, profession_name = $7,
			batch_id = $8, difficulty = $9, version = $10, background = $11, delivery_goal = $12,
			co_builder_ids = $13, updated_at = NOW()
		WHERE id = $14
	`, req.Name, req.Code, req.CoverImage, req.CareerPositionID, req.IndustryID,
		req.ProfessionID, req.ProfessionName, req.BatchID, req.Difficulty, req.Version, req.Background,
		req.DeliveryGoal, coBuilderIDs, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update scenario")
		return
	}

	scenario, _ := h.fetchScenario(r.Context(), id)
	respondJSON(w, http.StatusOK, scenario)
}

func (h *ScenarioHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchScenario(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "scenario not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM scenarios WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete scenario")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ScenarioHandler) actions() contentActions {
	return contentActions{
		db:         h.DB,
		table:      "scenarios",
		entityName: "scenario",
		inviteCol:  "co_builder_ids",
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.fetchScenario(ctx, id)
		},
	}
}

func (h *ScenarioHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *ScenarioHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *ScenarioHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}

func (h *ScenarioHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *ScenarioHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPublished)
}

func (h *ScenarioHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *ScenarioHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *ScenarioHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

func (h *ScenarioHandler) fetchScenario(ctx context.Context, id string) (*domain.Scenario, error) {
	var s domain.Scenario
	err := h.DB.QueryRow(ctx, `
		SELECT s.id, s.name, s.code, s.cover_image, s.career_position_id, s.industry_id, COALESCE(i.name, '') AS industry_name,
			s.profession_id, s.profession_name, s.batch_id, s.difficulty, s.version, s.status, s.background,
			s.delivery_goal, s.creator_id, s.co_builder_ids, s.tenant_id, s.created_at, s.updated_at, s.publish_time,
			(SELECT COUNT(*) FROM view_logs WHERE target_type = 'scenario' AND target_id = s.id) AS view_count
		FROM scenarios s
		LEFT JOIN industries i ON i.id = s.industry_id
		WHERE s.id = $1
	`, id).Scan(
		&s.ID, &s.Name, &s.Code, &s.CoverImage, &s.CareerPositionID, &s.IndustryID, &s.IndustryName,
		&s.ProfessionID, &s.ProfessionName, &s.BatchID, &s.Difficulty, &s.Version, &s.Status, &s.Background,
		&s.DeliveryGoal, &s.CreatorID, &s.CoBuilderIDs, &s.TenantID, &s.CreatedAt, &s.UpdatedAt, &s.PublishTime, &s.ViewCount,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (h *ScenarioHandler) scanScenarioRows(rows pgx.Rows) ([]domain.Scenario, error) {
	items := make([]domain.Scenario, 0)
	for rows.Next() {
		var s domain.Scenario
		if err := rows.Scan(
			&s.ID, &s.Name, &s.Code, &s.CoverImage, &s.CareerPositionID, &s.IndustryID, &s.IndustryName,
			&s.ProfessionID, &s.ProfessionName, &s.BatchID, &s.Difficulty, &s.Version, &s.Status, &s.Background,
			&s.DeliveryGoal, &s.CreatorID, &s.CoBuilderIDs, &s.TenantID, &s.CreatedAt, &s.UpdatedAt, &s.PublishTime, &s.ViewCount,
		); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, nil
}
