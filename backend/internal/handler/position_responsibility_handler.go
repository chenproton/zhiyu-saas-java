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

type PositionResponsibilityHandler struct {
	DB *pgxpool.Pool
}

type PositionResponsibilityListResponse struct {
	Items []domain.PositionResponsibility `json:"items"`
	Total int                             `json:"total"`
}

type CreatePositionResponsibilityRequest struct {
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	SortOrder        int     `json:"sortOrder"`
}

type UpdatePositionResponsibilityRequest struct {
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	SortOrder        int     `json:"sortOrder"`
}

func (h *PositionResponsibilityHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	careerPositionID := r.URL.Query().Get("careerPositionId")
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

	if careerPositionID != "" {
		where = append(where, "career_position_id = $"+itoa(argIdx))
		args = append(args, careerPositionID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM position_responsibilities WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, career_position_id, name, description, sort_order
		FROM position_responsibilities
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY sort_order ASC, id ASC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list responsibilities")
		return
	}
	defer rows.Close()

	items, err := h.scanResponsibilityRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan responsibilities")
		return
	}

	respondJSON(w, http.StatusOK, PositionResponsibilityListResponse{Items: items, Total: total})
}

func (h *PositionResponsibilityHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.fetchResponsibility(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "responsibility not found")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *PositionResponsibilityHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreatePositionResponsibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO position_responsibilities (id, career_position_id, name, description, sort_order)
		VALUES ($1, $2, $3, $4, $5)
	`, id, req.CareerPositionID, req.Name, req.Description, req.SortOrder)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create responsibility")
		return
	}

	item, _ := h.fetchResponsibility(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *PositionResponsibilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchResponsibility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "responsibility not found")
		return
	}

	var req UpdatePositionResponsibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE position_responsibilities SET
			career_position_id = $1, name = $2, description = $3, sort_order = $4
		WHERE id = $5
	`, req.CareerPositionID, req.Name, req.Description, req.SortOrder, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update responsibility")
		return
	}

	item, _ := h.fetchResponsibility(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *PositionResponsibilityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchResponsibility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "responsibility not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM position_responsibilities WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete responsibility")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *PositionResponsibilityHandler) fetchResponsibility(ctx context.Context, id string) (domain.PositionResponsibility, error) {
	var item domain.PositionResponsibility
	var description *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, career_position_id, name, description, sort_order
		FROM position_responsibilities WHERE id = $1
	`, id).Scan(
		&item.ID, &item.CareerPositionID, &item.Name, &description, &item.SortOrder,
	)
	if err != nil {
		return item, err
	}
	item.Description = description
	return item, nil
}

func (h *PositionResponsibilityHandler) scanResponsibilityRows(rows pgx.Rows) ([]domain.PositionResponsibility, error) {
	items := make([]domain.PositionResponsibility, 0)
	for rows.Next() {
		var item domain.PositionResponsibility
		var description *string
		if err := rows.Scan(
			&item.ID, &item.CareerPositionID, &item.Name, &description, &item.SortOrder,
		); err != nil {
			return nil, err
		}
		item.Description = description
		items = append(items, item)
	}
	return items, nil
}
