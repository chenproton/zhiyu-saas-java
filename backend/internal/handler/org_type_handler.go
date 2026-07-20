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

type OrgTypeHandler struct {
	DB *pgxpool.Pool
}

type OrgTypeListResponse struct {
	Items []domain.OrgType `json:"items"`
	Total int              `json:"total"`
}

type CreateOrgTypeRequest struct {
	TenantID    string                 `json:"tenantId"`
	Name        string                 `json:"name"`
	Category    domain.OrgTypeCategory `json:"category"`
	Description *string                `json:"description"`
}

type UpdateOrgTypeRequest struct {
	Name        string                 `json:"name"`
	Category    domain.OrgTypeCategory `json:"category"`
	Description *string                `json:"description"`
}

func (h *OrgTypeHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
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

	if tenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, tenantID)
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

	countQuery := "SELECT COUNT(*) FROM org_types WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, name, category, description, created_at
		FROM org_types
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list org types")
		return
	}
	defer rows.Close()

	items, err := h.scanOrgTypeRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan org types")
		return
	}

	respondJSON(w, http.StatusOK, OrgTypeListResponse{Items: items, Total: total})
}

func (h *OrgTypeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	orgType, err := h.fetchOrgType(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "org type not found")
		return
	}
	respondJSON(w, http.StatusOK, orgType)
}

func (h *OrgTypeHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateOrgTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.TenantID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	if req.Category != domain.OrgTypeCategoryInternal && req.Category != domain.OrgTypeCategoryBusiness && req.Category != domain.OrgTypeCategoryExternal {
		req.Category = domain.OrgTypeCategoryInternal
	}

	id := uuid.NewString()

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO org_types (id, tenant_id, name, category, description)
		VALUES ($1, $2, $3, $4, $5)
	`, id, req.TenantID, req.Name, req.Category, req.Description)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "组织类型名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create org type")
		return
	}

	orgType, _ := h.fetchOrgType(r.Context(), id)
	respondJSON(w, http.StatusCreated, orgType)
}

func (h *OrgTypeHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchOrgType(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "org type not found")
		return
	}

	var req UpdateOrgTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	if req.Category != domain.OrgTypeCategoryInternal && req.Category != domain.OrgTypeCategoryBusiness && req.Category != domain.OrgTypeCategoryExternal {
		respondError(w, http.StatusBadRequest, "invalid category")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE org_types SET name = $1, category = $2, description = $3
		WHERE id = $4
	`, req.Name, req.Category, req.Description, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "组织类型名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update org type")
		return
	}

	orgType, _ := h.fetchOrgType(r.Context(), id)
	respondJSON(w, http.StatusOK, orgType)
}

func (h *OrgTypeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchOrgType(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "org type not found")
		return
	}

	var refCount int
	if err := h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM organizations WHERE type_id = $1`, id).Scan(&refCount); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to check org type references")
		return
	}
	if refCount > 0 {
		respondError(w, http.StatusConflict, "该组织类型仍被组织使用，不可删除")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM org_types WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete org type")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *OrgTypeHandler) fetchOrgType(ctx context.Context, id string) (domain.OrgType, error) {
	var ot domain.OrgType
	var description *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, category, description, created_at
		FROM org_types WHERE id = $1
	`, id).Scan(
		&ot.ID, &ot.TenantID, &ot.Name, &ot.Category, &description, &ot.CreatedAt,
	)
	if err != nil {
		return ot, err
	}
	ot.Description = description
	return ot, nil
}

func (h *OrgTypeHandler) scanOrgTypeRows(rows pgx.Rows) ([]domain.OrgType, error) {
	items := make([]domain.OrgType, 0)
	for rows.Next() {
		var ot domain.OrgType
		var description *string
		if err := rows.Scan(
			&ot.ID, &ot.TenantID, &ot.Name, &ot.Category, &description, &ot.CreatedAt,
		); err != nil {
			return nil, err
		}
		ot.Description = description
		items = append(items, ot)
	}
	return items, nil
}
