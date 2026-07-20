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

type RoleHandler struct {
	DB *pgxpool.Pool
}

type RoleListResponse struct {
	Items []domain.Role `json:"items"`
	Total int           `json:"total"`
}

type CreateRoleRequest struct {
	TenantID    string         `json:"tenantId"`
	Code        string         `json:"code"`
	Name        string         `json:"name"`
	Description *string        `json:"description"`
	Permissions domain.JSONMap `json:"permissions"`
}

type UpdateRoleRequest struct {
	Name        string         `json:"name"`
	Description *string        `json:"description"`
	Permissions domain.JSONMap `json:"permissions"`
}

type AssignRoleRequest struct {
	UserID string `json:"userId"`
}

func (h *RoleHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	status := r.URL.Query().Get("status")
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
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM roles WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, code, name, description, permissions, user_count, status, created_at
		FROM roles
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list roles")
		return
	}
	defer rows.Close()

	items, err := h.scanRoleRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan roles")
		return
	}

	respondJSON(w, http.StatusOK, RoleListResponse{Items: items, Total: total})
}

func (h *RoleHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, err := h.fetchRole(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "role not found")
		return
	}
	respondJSON(w, http.StatusOK, role)
}

func (h *RoleHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.TenantID == "" || req.Code == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	if req.Permissions == nil {
		req.Permissions = domain.JSONMap{}
	}

	id := uuid.NewString()

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status)
		VALUES ($1, $2, $3, $4, $5, $6, 0, 'active')
	`, id, req.TenantID, req.Code, req.Name, req.Description, req.Permissions)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "角色代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create role")
		return
	}

	role, _ := h.fetchRole(r.Context(), id)
	respondJSON(w, http.StatusCreated, role)
}

func (h *RoleHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchRole(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "role not found")
		return
	}

	var req UpdateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	if req.Permissions == nil {
		req.Permissions = domain.JSONMap{}
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE roles SET name = $1, description = $2, permissions = $3
		WHERE id = $4
	`, req.Name, req.Description, req.Permissions, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update role")
		return
	}

	role, _ := h.fetchRole(r.Context(), id)
	respondJSON(w, http.StatusOK, role)
}

func (h *RoleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchRole(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "role not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM roles WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete role")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *RoleHandler) Assign(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchRole(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "role not found")
		return
	}

	var req AssignRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.UserID == "" {
		respondError(w, http.StatusBadRequest, "missing user id")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO user_roles (id, user_id, role_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, role_id) DO NOTHING
	`, uuid.NewString(), req.UserID, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to assign role")
		return
	}

	_, _ = h.DB.Exec(r.Context(), `UPDATE roles SET user_count = user_count + 1 WHERE id = $1`, id)

	respondJSON(w, http.StatusOK, map[string]string{"roleId": id, "userId": req.UserID})
}

func (h *RoleHandler) fetchRole(ctx context.Context, id string) (domain.Role, error) {
	var role domain.Role
	var description *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, description, permissions, user_count, status, created_at
		FROM roles WHERE id = $1
	`, id).Scan(
		&role.ID, &role.TenantID, &role.Code, &role.Name, &description, &role.Permissions, &role.UserCount, &role.Status, &role.CreatedAt,
	)
	if err != nil {
		return role, err
	}
	role.Description = description
	return role, nil
}

func (h *RoleHandler) scanRoleRows(rows pgx.Rows) ([]domain.Role, error) {
	items := make([]domain.Role, 0)
	for rows.Next() {
		var role domain.Role
		var description *string
		if err := rows.Scan(
			&role.ID, &role.TenantID, &role.Code, &role.Name, &description, &role.Permissions, &role.UserCount, &role.Status, &role.CreatedAt,
		); err != nil {
			return nil, err
		}
		role.Description = description
		items = append(items, role)
	}
	return items, nil
}
