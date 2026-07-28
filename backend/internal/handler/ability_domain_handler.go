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

type AbilityDomainHandler struct {
	DB *pgxpool.Pool
}

type AbilityDomainListResponse struct {
	Items []domain.AbilityDomain `json:"items"`
	Total int                    `json:"total"`
}

type CreateAbilityDomainRequest struct {
	CareerPositionID string   `json:"careerPositionId"`
	Name             string   `json:"name"`
	Description      *string  `json:"description"`
	BindingIDs       []string `json:"bindingIds"`
	SortOrder        int      `json:"sortOrder"`
}

type UpdateAbilityDomainRequest struct {
	CareerPositionID string   `json:"careerPositionId"`
	Name             string   `json:"name"`
	Description      *string  `json:"description"`
	BindingIDs       []string `json:"bindingIds"`
	SortOrder        int      `json:"sortOrder"`
}

func (h *AbilityDomainHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	careerPositionID := r.URL.Query().Get("careerPositionId")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
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
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if careerPositionID != "" {
		where = append(where, "career_position_id = $"+itoa(argIdx))
		args = append(args, careerPositionID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM ability_domains WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, career_position_id, name, description, binding_ids, sort_order
		FROM ability_domains
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY sort_order ASC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list ability domains")
		return
	}
	defer rows.Close()

	items, err := h.scanDomainRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan ability domains")
		return
	}

	respondJSON(w, http.StatusOK, AbilityDomainListResponse{Items: items, Total: total})
}

func (h *AbilityDomainHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateAbilityDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, tenantID, req.CareerPositionID, req.Name, req.Description, coalesceStringSlice(req.BindingIDs), req.SortOrder)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create ability domain")
		return
	}

	d, _ := h.fetchDomain(r.Context(), id)
	respondJSON(w, http.StatusCreated, d)
}

func (h *AbilityDomainHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchDomain(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "ability domain not found")
		return
	}

	var req UpdateAbilityDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE ability_domains SET
			career_position_id = $1, name = $2, description = $3, binding_ids = $4, sort_order = $5
		WHERE id = $6
	`, req.CareerPositionID, req.Name, req.Description, coalesceStringSlice(req.BindingIDs), req.SortOrder, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update ability domain")
		return
	}

	d, _ := h.fetchDomain(r.Context(), id)
	respondJSON(w, http.StatusOK, d)
}

func (h *AbilityDomainHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchDomain(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "ability domain not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM ability_domains WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete ability domain")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AbilityDomainHandler) fetchDomain(ctx context.Context, id string) (domain.AbilityDomain, error) {
	var d domain.AbilityDomain
	var description *string
	var bindingIDs []string

	err := h.DB.QueryRow(ctx, `
		SELECT id, career_position_id, name, description, binding_ids, sort_order
		FROM ability_domains WHERE id = $1
	`, id).Scan(
		&d.ID, &d.CareerPositionID, &d.Name, &description, &bindingIDs, &d.SortOrder,
	)
	if err != nil {
		return d, err
	}
	d.Description = description
	d.BindingIDs = bindingIDs
	return d, nil
}

func (h *AbilityDomainHandler) scanDomainRows(rows pgx.Rows) ([]domain.AbilityDomain, error) {
	items := make([]domain.AbilityDomain, 0)
	for rows.Next() {
		var d domain.AbilityDomain
		var description *string
		var bindingIDs []string
		if err := rows.Scan(
			&d.ID, &d.CareerPositionID, &d.Name, &description, &bindingIDs, &d.SortOrder,
		); err != nil {
			return nil, err
		}
		d.Description = description
		d.BindingIDs = bindingIDs
		items = append(items, d)
	}
	return items, nil
}
