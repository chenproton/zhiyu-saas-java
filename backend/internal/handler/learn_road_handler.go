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

type LearnRoadHandler struct {
	DB *pgxpool.Pool
}

type LearnRoadListResponse struct {
	Items []domain.LearnRoad `json:"items"`
	Total int                `json:"total"`
}

type CreateLearnRoadRequest struct {
	Name        string           `json:"name"`
	Description *string          `json:"description"`
	PositionIDs []string         `json:"positionIds"`
	Steps       domain.JSONSlice `json:"steps"`
}

type UpdateLearnRoadRequest struct {
	Name        string           `json:"name"`
	Description *string          `json:"description"`
	PositionIDs []string         `json:"positionIds"`
	Steps       domain.JSONSlice `json:"steps"`
}

func (h *LearnRoadHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

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

	if search != "" {
		where = append(where, "name ILIKE $"+itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM learn_roads WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, name, description, position_ids, steps, created_at, updated_at
		FROM learn_roads
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list learn roads")
		return
	}
	defer rows.Close()

	items, err := h.scanLearnRoadRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan learn roads")
		return
	}

	respondJSON(w, http.StatusOK, LearnRoadListResponse{Items: items, Total: total})
}

func (h *LearnRoadHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	road, err := h.fetchLearnRoad(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "learn road not found")
		return
	}
	respondJSON(w, http.StatusOK, road)
}

func (h *LearnRoadHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateLearnRoadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}
	if req.Steps == nil {
		req.Steps = domain.JSONSlice{}
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	positionUUIDs := make([]string, len(req.PositionIDs))
	for i, pid := range req.PositionIDs {
		if u, err := uuid.Parse(pid); err == nil {
			positionUUIDs[i] = u.String()
		} else {
			positionUUIDs[i] = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(pid)).String()
		}
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO learn_roads (id, tenant_id, name, description, position_ids, steps)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, req.Name, req.Description, positionUUIDs, req.Steps)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "学习路线名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create learn road")
		return
	}

	road, _ := h.fetchLearnRoad(r.Context(), id)
	respondJSON(w, http.StatusCreated, road)
}

func (h *LearnRoadHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchLearnRoad(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "learn road not found")
		return
	}

	var req UpdateLearnRoadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	positionIDs := req.PositionIDs
	if positionIDs == nil {
		positionIDs = existing.PositionIDs
	}
	steps := req.Steps
	if steps == nil {
		steps = existing.Steps
	}

	positionUUIDs := make([]string, len(positionIDs))
	for i, pid := range positionIDs {
		if u, err := uuid.Parse(pid); err == nil {
			positionUUIDs[i] = u.String()
		} else {
			positionUUIDs[i] = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(pid)).String()
		}
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE learn_roads SET
			name = $1, description = $2, position_ids = $3, steps = $4, updated_at = NOW()
		WHERE id = $5
	`, req.Name, req.Description, positionUUIDs, steps, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "学习路线名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update learn road")
		return
	}

	road, _ := h.fetchLearnRoad(r.Context(), id)
	respondJSON(w, http.StatusOK, road)
}

func (h *LearnRoadHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchLearnRoad(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "learn road not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM learn_roads WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete learn road")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *LearnRoadHandler) fetchLearnRoad(ctx context.Context, id string) (domain.LearnRoad, error) {
	var road domain.LearnRoad
	var description *string
	var positionIDs []string
	var steps domain.JSONSlice

	err := h.DB.QueryRow(ctx, `
		SELECT id, name, description, position_ids, steps, created_at, updated_at
		FROM learn_roads WHERE id = $1
	`, id).Scan(
		&road.ID, &road.Name, &description, &positionIDs, &steps, &road.CreatedAt, &road.UpdatedAt,
	)
	if err != nil {
		return road, err
	}
	road.Description = description
	road.PositionIDs = positionIDs
	road.Steps = steps
	return road, nil
}

func (h *LearnRoadHandler) scanLearnRoadRows(rows pgx.Rows) ([]domain.LearnRoad, error) {
	items := make([]domain.LearnRoad, 0)
	for rows.Next() {
		var road domain.LearnRoad
		var description *string
		var positionIDs []string
		var steps domain.JSONSlice
		if err := rows.Scan(
			&road.ID, &road.Name, &description, &positionIDs, &steps, &road.CreatedAt, &road.UpdatedAt,
		); err != nil {
			return nil, err
		}
		road.Description = description
		road.PositionIDs = positionIDs
		road.Steps = steps
		items = append(items, road)
	}
	return items, nil
}
