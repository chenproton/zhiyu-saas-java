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

type AbilityHandler struct {
	DB *pgxpool.Pool
}

type AbilityListResponse struct {
	Items []domain.AbilityPoint `json:"items"`
	Total int                   `json:"total"`
}

type CreateAbilityRequest struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Category    string   `json:"category"`
	Domain      *string  `json:"domain"`
	Attributes  []string `json:"attributes"`
	IsPublic    bool     `json:"isPublic"`
}

type UpdateAbilityRequest struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Category    string   `json:"category"`
	Domain      *string  `json:"domain"`
	Attributes  []string `json:"attributes"`
	IsPublic    bool     `json:"isPublic"`
}

func (h *AbilityHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	category := r.URL.Query().Get("category")
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

	if category != "" {
		where = append(where, "category = $"+itoa(argIdx))
		args = append(args, category)
		argIdx++
	}
	if search != "" {
		where = append(where, "name ILIKE $"+itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM ability_points WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, name, description, category, domain, attributes, is_public, created_at
		FROM ability_points
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list abilities")
		return
	}
	defer rows.Close()

	items, err := h.scanAbilityRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan abilities")
		return
	}

	respondJSON(w, http.StatusOK, AbilityListResponse{Items: items, Total: total})
}

func (h *AbilityHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	ability, err := h.fetchAbility(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "ability point not found")
		return
	}
	respondJSON(w, http.StatusOK, ability)
}

func (h *AbilityHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateAbilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.Category == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO ability_points (id, tenant_id, name, description, category, domain, attributes, is_public)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, id, tenantID, req.Name, req.Description, req.Category, req.Domain, req.Attributes, req.IsPublic)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "能力点名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create ability point")
		return
	}

	ability, _ := h.fetchAbility(r.Context(), id)
	respondJSON(w, http.StatusCreated, ability)
}

func (h *AbilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchAbility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "ability point not found")
		return
	}

	var req UpdateAbilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.Category == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE ability_points SET name = $1, description = $2, category = $3, domain = $4, attributes = $5, is_public = $6
		WHERE id = $7
	`, req.Name, req.Description, req.Category, req.Domain, req.Attributes, req.IsPublic, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "能力点名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update ability point")
		return
	}

	ability, _ := h.fetchAbility(r.Context(), id)
	respondJSON(w, http.StatusOK, ability)
}

func (h *AbilityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchAbility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "ability point not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM ability_points WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete ability point")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AbilityHandler) fetchAbility(ctx context.Context, id string) (domain.AbilityPoint, error) {
	var a domain.AbilityPoint
	var description *string
	var domainStr *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, name, description, category, domain, attributes, is_public, created_at
		FROM ability_points WHERE id = $1
	`, id).Scan(
		&a.ID, &a.Name, &description, &a.Category, &domainStr, &a.Attributes, &a.IsPublic, &a.CreatedAt,
	)
	if err != nil {
		return a, err
	}
	a.Description = description
	a.Domain = domainStr
	return a, nil
}

func (h *AbilityHandler) scanAbilityRows(rows pgx.Rows) ([]domain.AbilityPoint, error) {
	items := make([]domain.AbilityPoint, 0)
	for rows.Next() {
		var a domain.AbilityPoint
		var description *string
		var domainStr *string
		if err := rows.Scan(
			&a.ID, &a.Name, &description, &a.Category, &domainStr, &a.Attributes, &a.IsPublic, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		a.Description = description
		a.Domain = domainStr
		items = append(items, a)
	}
	return items, nil
}
