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

type RecommendHandler struct {
	DB *pgxpool.Pool
}

type RecommendListResponse struct {
	Items []domain.PositionRecommendation `json:"items"`
	Total int                             `json:"total"`
}

type CreateRecommendRequest struct {
	MajorID          *string `json:"majorId"`
	CareerPositionID string  `json:"careerPositionId"`
	PositionType     string  `json:"positionType"`
	Reason           *string `json:"reason"`
	SortOrder        int     `json:"sortOrder"`
	IsEnabled        bool    `json:"isEnabled"`
}

type UpdateRecommendRequest struct {
	MajorID          *string `json:"majorId"`
	CareerPositionID string  `json:"careerPositionId"`
	PositionType     string  `json:"positionType"`
	Reason           *string `json:"reason"`
	SortOrder        int     `json:"sortOrder"`
	IsEnabled        bool    `json:"isEnabled"`
}

func (h *RecommendHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	majorID := r.URL.Query().Get("majorId")
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
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "pr.tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if majorID != "" {
		where = append(where, "pr.major_id = $"+itoa(argIdx))
		args = append(args, majorID)
		argIdx++
	}
	if careerPositionID != "" {
		where = append(where, "pr.career_position_id = $"+itoa(argIdx))
		args = append(args, careerPositionID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM position_recommendations pr WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT pr.id, pr.major_id, COALESCE(m.name, '') AS major_name,
			pr.career_position_id, pr.position_type, pr.reason, pr.sort_order,
			pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at
		FROM position_recommendations pr
		LEFT JOIN majors m ON m.id = pr.major_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY pr.sort_order ASC, pr.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list recommendations")
		return
	}
	defer rows.Close()

	items, err := h.scanRecommendRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan recommendations")
		return
	}

	respondJSON(w, http.StatusOK, RecommendListResponse{Items: items, Total: total})
}

func (h *RecommendHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateRecommendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CareerPositionID == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO position_recommendations (
			id, tenant_id, major_id, career_position_id, position_type, reason, sort_order, is_enabled, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, id, tenantID, req.MajorID, req.CareerPositionID, req.PositionType, req.Reason, req.SortOrder, req.IsEnabled, claims.UserID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create recommendation")
		return
	}

	rec, _ := h.fetchRecommend(r.Context(), id)
	respondJSON(w, http.StatusCreated, rec)
}

func (h *RecommendHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchRecommend(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "recommendation not found")
		return
	}

	var req UpdateRecommendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CareerPositionID == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE position_recommendations SET
			major_id = $1, career_position_id = $2, position_type = $3, reason = $4,
			sort_order = $5, is_enabled = $6, updated_at = NOW()
		WHERE id = $7
	`, req.MajorID, req.CareerPositionID, req.PositionType, req.Reason, req.SortOrder, req.IsEnabled, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update recommendation")
		return
	}

	rec, _ := h.fetchRecommend(r.Context(), id)
	respondJSON(w, http.StatusOK, rec)
}

func (h *RecommendHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchRecommend(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "recommendation not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM position_recommendations WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete recommendation")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *RecommendHandler) fetchRecommend(ctx context.Context, id string) (domain.PositionRecommendation, error) {
	var rec domain.PositionRecommendation
	var reason *string

	err := h.DB.QueryRow(ctx, `
		SELECT pr.id, pr.major_id, COALESCE(m.name, '') AS major_name,
			pr.career_position_id, pr.position_type, pr.reason, pr.sort_order,
			pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at
		FROM position_recommendations pr
		LEFT JOIN majors m ON m.id = pr.major_id
		WHERE pr.id = $1
	`, id).Scan(
		&rec.ID, &rec.MajorID, &rec.MajorName, &rec.CareerPositionID, &rec.PositionType, &reason, &rec.SortOrder,
		&rec.IsEnabled, &rec.CreatedBy, &rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		return rec, err
	}
	rec.Reason = reason
	return rec, nil
}

func (h *RecommendHandler) scanRecommendRows(rows pgx.Rows) ([]domain.PositionRecommendation, error) {
	items := make([]domain.PositionRecommendation, 0)
	for rows.Next() {
		var rec domain.PositionRecommendation
		var reason *string
		if err := rows.Scan(
			&rec.ID, &rec.MajorID, &rec.MajorName, &rec.CareerPositionID, &rec.PositionType, &reason, &rec.SortOrder,
			&rec.IsEnabled, &rec.CreatedBy, &rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		rec.Reason = reason
		items = append(items, rec)
	}
	return items, nil
}
