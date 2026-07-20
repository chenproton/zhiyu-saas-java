package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CertificateLibraryHandler struct {
	DB *pgxpool.Pool
}

type CertificateLibraryListResponse struct {
	Items []domain.CertificateLibraryItem `json:"items"`
	Total int                              `json:"total"`
}

type CreateCertificateLibraryRequest struct {
	Name        string  `json:"name"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	ImageURL    *string `json:"imageUrl"`
}

type UpdateCertificateLibraryRequest struct {
	Name        *string `json:"name"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	ImageURL    *string `json:"imageUrl"`
}

func (h *CertificateLibraryHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	search := r.URL.Query().Get("search")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR description ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM certificate_library WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, name, url, description, image_url, created_at
		FROM certificate_library
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list certificate library")
		return
	}
	defer rows.Close()

	items := make([]domain.CertificateLibraryItem, 0)
	for rows.Next() {
		var item domain.CertificateLibraryItem
		var url, description, imageURL *string
		if err := rows.Scan(
			&item.ID, &item.TenantID, &item.Name, &url, &description, &imageURL, &item.CreatedAt,
		); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to scan certificate library")
			return
		}
		item.URL = url
		item.Description = description
		item.ImageURL = imageURL
		items = append(items, item)
	}

	respondJSON(w, http.StatusOK, CertificateLibraryListResponse{Items: items, Total: total})
}

func (h *CertificateLibraryHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "certificate not found")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *CertificateLibraryHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateCertificateLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, req.Name, req.URL, req.Description, req.ImageURL)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create certificate")
		return
	}

	item, _ := h.fetchItem(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *CertificateLibraryHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "certificate not found")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdateCertificateLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	name := existing.Name
	url := existing.URL
	description := existing.Description
	imageURL := existing.ImageURL
	if req.Name != nil {
		name = *req.Name
	}
	if req.URL != nil {
		url = req.URL
	}
	if req.Description != nil {
		description = req.Description
	}
	if req.ImageURL != nil {
		imageURL = req.ImageURL
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE certificate_library SET
			name = $1, url = $2, description = $3, image_url = $4
		WHERE id = $5
	`, name, url, description, imageURL, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update certificate")
		return
	}

	item, _ := h.fetchItem(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *CertificateLibraryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "certificate not found")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM certificate_library WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete certificate")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CertificateLibraryHandler) fetchItem(ctx context.Context, id string) (domain.CertificateLibraryItem, error) {
	var item domain.CertificateLibraryItem
	var url, description, imageURL *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, url, description, image_url, created_at
		FROM certificate_library WHERE id = $1
	`, id).Scan(
		&item.ID, &item.TenantID, &item.Name, &url, &description, &imageURL, &item.CreatedAt,
	)
	if err != nil {
		return item, err
	}
	item.URL = url
	item.Description = description
	item.ImageURL = imageURL
	return item, nil
}
