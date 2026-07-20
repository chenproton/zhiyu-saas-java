package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ResourceCodeHandler struct {
	DB *pgxpool.Pool
}

type ResourceCodeListResponse struct {
	Items []domain.ResourceCode `json:"items"`
	Total int                   `json:"total"`
}

func (h *ResourceCodeHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	resType := r.URL.Query().Get("type")
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

	if tenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, tenantID)
		argIdx++
	}
	if resType != "" {
		where = append(where, "type = $"+itoa(argIdx))
		args = append(args, resType)
		argIdx++
	}
	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM resource_codes WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, code, name, description, type, created_at
		FROM resource_codes
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list resource codes")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceCodeRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan resource codes")
		return
	}

	respondJSON(w, http.StatusOK, ResourceCodeListResponse{Items: items, Total: total})
}

func (h *ResourceCodeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	resourceCode, err := h.fetchResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "resource code not found")
		return
	}
	if !verifyTenantOwnership(w, r, resourceCode.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, resourceCode)
}

func (h *ResourceCodeHandler) fetchResourceCode(ctx context.Context, id string) (domain.ResourceCode, error) {
	var rc domain.ResourceCode
	var description *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, description, type, created_at
		FROM resource_codes WHERE id = $1
	`, id).Scan(
		&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt,
	)
	if err != nil {
		return rc, err
	}
	rc.Description = description
	return rc, nil
}

func (h *ResourceCodeHandler) scanResourceCodeRows(rows pgx.Rows) ([]domain.ResourceCode, error) {
	items := make([]domain.ResourceCode, 0)
	for rows.Next() {
		var rc domain.ResourceCode
		var description *string
		if err := rows.Scan(
			&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt,
		); err != nil {
			return nil, err
		}
		rc.Description = description
		items = append(items, rc)
	}
	return items, nil
}
