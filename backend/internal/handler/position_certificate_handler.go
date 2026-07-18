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

type PositionCertificateHandler struct {
	DB *pgxpool.Pool
}

type PositionCertificateListResponse struct {
	Items []domain.PositionCertificate `json:"items"`
	Total int                          `json:"total"`
}

type CreatePositionCertificateRequest struct {
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	URL              *string `json:"url"`
	Description      *string `json:"description"`
	ImageURL         *string `json:"imageUrl"`
}

type UpdatePositionCertificateRequest struct {
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	URL              *string `json:"url"`
	Description      *string `json:"description"`
	ImageURL         *string `json:"imageUrl"`
}

func (h *PositionCertificateHandler) List(w http.ResponseWriter, r *http.Request) {
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

	countQuery := "SELECT COUNT(*) FROM position_certificates WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, career_position_id, name, url, description, image_url
		FROM position_certificates
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY name ASC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list certificates")
		return
	}
	defer rows.Close()

	items, err := h.scanCertificateRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan certificates")
		return
	}

	respondJSON(w, http.StatusOK, PositionCertificateListResponse{Items: items, Total: total})
}

func (h *PositionCertificateHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.fetchCertificate(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "certificate not found")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *PositionCertificateHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreatePositionCertificateRequest
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
		INSERT INTO position_certificates (id, career_position_id, name, url, description, image_url)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, req.CareerPositionID, req.Name, req.URL, req.Description, req.ImageURL)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create certificate")
		return
	}

	item, _ := h.fetchCertificate(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *PositionCertificateHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchCertificate(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "certificate not found")
		return
	}

	var req UpdatePositionCertificateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE position_certificates SET
			career_position_id = $1, name = $2, url = $3, description = $4, image_url = $5
		WHERE id = $6
	`, req.CareerPositionID, req.Name, req.URL, req.Description, req.ImageURL, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update certificate")
		return
	}

	item, _ := h.fetchCertificate(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *PositionCertificateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchCertificate(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "certificate not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM position_certificates WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete certificate")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *PositionCertificateHandler) fetchCertificate(ctx context.Context, id string) (domain.PositionCertificate, error) {
	var item domain.PositionCertificate
	var url, description, imageURL *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, career_position_id, name, url, description, image_url
		FROM position_certificates WHERE id = $1
	`, id).Scan(
		&item.ID, &item.CareerPositionID, &item.Name, &url, &description, &imageURL,
	)
	if err != nil {
		return item, err
	}
	item.URL = url
	item.Description = description
	item.ImageURL = imageURL
	return item, nil
}

func (h *PositionCertificateHandler) scanCertificateRows(rows pgx.Rows) ([]domain.PositionCertificate, error) {
	items := make([]domain.PositionCertificate, 0)
	for rows.Next() {
		var item domain.PositionCertificate
		var url, description, imageURL *string
		if err := rows.Scan(
			&item.ID, &item.CareerPositionID, &item.Name, &url, &description, &imageURL,
		); err != nil {
			return nil, err
		}
		item.URL = url
		item.Description = description
		item.ImageURL = imageURL
		items = append(items, item)
	}
	return items, nil
}
