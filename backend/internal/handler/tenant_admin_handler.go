package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// CreateTenantAdminRequest is used by the superadmin console to add a school admin.
type CreateTenantAdminRequest struct {
	Username string `json:"username"`
	Name     string `json:"name"`
}

// UpdateTenantAdminRequest is used by the superadmin console to edit a school admin.
type UpdateTenantAdminRequest struct {
	Username string `json:"username"`
	Name     string `json:"name"`
}

// TenantAdminResponse returns school admin user info. PlainPassword is only
// populated on creation or when explicitly previewed.
type TenantAdminResponse struct {
	ID            string     `json:"id"`
	TenantID      string     `json:"tenantId"`
	Username      string     `json:"username"`
	LoginName     string     `json:"loginName"`
	Name          string     `json:"name"`
	Status        string     `json:"status"`
	NewPassword   string     `json:"newPassword,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
	LastLoginAt   *time.Time `json:"lastLoginAt,omitempty"`
}

// AdminListAdmins lists all school_admin users for a tenant.
func (h *TenantHandler) AdminListAdmins(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "tenant not found")
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT u.id, u.tenant_id, u.username, u.login_name, u.name, u.status, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.tenant_id = $1 AND r.code = 'school_admin'
		ORDER BY u.created_at DESC
	`, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list admins")
		return
	}
	defer rows.Close()

	var items []TenantAdminResponse
	for rows.Next() {
		var a TenantAdminResponse
		var loginName *string
		if err := rows.Scan(&a.ID, &a.TenantID, &a.Username, &loginName, &a.Name, &a.Status, &a.LastLoginAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			continue
		}
		if loginName != nil {
			a.LoginName = *loginName
		}
		items = append(items, a)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

// AdminCreateAdmin creates a new school admin for a tenant with a random password.
func (h *TenantHandler) AdminCreateAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "tenant not found")
		return
	}

	var req CreateTenantAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	plainPassword, err := generateSecurePassword(12)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to generate password")
		return
	}

	admin, err := h.createTenantAdmin(r.Context(), tenantID, req.Username, req.Name, plainPassword)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create admin")
		return
	}

	admin.NewPassword = plainPassword
	respondJSON(w, http.StatusCreated, admin)
}

// AdminUpdateAdmin updates a school admin's username and name.
func (h *TenantHandler) AdminUpdateAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "tenant not found")
		return
	}

	existing, err := h.fetchTenantAdmin(r.Context(), tenantID, adminID)
	if err != nil {
		respondError(w, http.StatusNotFound, "admin not found")
		return
	}

	var req UpdateTenantAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	newLoginName := tenantID + "_" + req.Username
	_, err = h.DB.Exec(r.Context(), `
		UPDATE users SET username = $1, login_name = $2, name = $3, updated_at = NOW()
		WHERE id = $4 AND tenant_id = $5
	`, req.Username, newLoginName, req.Name, adminID, tenantID)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update admin")
		return
	}

	updated, _ := h.fetchTenantAdmin(r.Context(), tenantID, adminID)
	_ = existing
	respondJSON(w, http.StatusOK, updated)
}

// AdminDeleteAdmin deletes a school admin user.
func (h *TenantHandler) AdminDeleteAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "tenant not found")
		return
	}

	if _, err := h.fetchTenantAdmin(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "admin not found")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `
		UPDATE roles SET user_count = GREATEST(user_count - 1, 0)
		WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = $1)
	`, adminID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update role count")
		return
	}

	if _, err := tx.Exec(r.Context(), `DELETE FROM user_roles WHERE user_id = $1`, adminID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete user roles")
		return
	}

	if _, err := tx.Exec(r.Context(), `
		UPDATE tenants SET admin_ids = array_remove(admin_ids, $1::UUID)
		WHERE id = $2
	`, adminID, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update tenant admins")
		return
	}

	if _, err := tx.Exec(r.Context(), `DELETE FROM users WHERE id = $1 AND tenant_id = $2`, adminID, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete admin")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "deleted": "true"})
}

// AdminResetPassword generates a new random password for a school admin,
// hashes and saves it, then returns the new password once.
func (h *TenantHandler) AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "tenant not found")
		return
	}

	if _, err := h.fetchTenantAdmin(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "admin not found")
		return
	}

	newPassword, err := generateSecurePassword(12)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to generate password")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	if _, err := h.DB.Exec(r.Context(), `
		UPDATE users SET password_hash = $1, updated_at = NOW()
		WHERE id = $2
	`, string(hash), adminID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save password")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "newPassword": newPassword})
}

func (h *TenantHandler) createTenantAdmin(ctx context.Context, tenantID, username, name, plainPassword string) (TenantAdminResponse, error) {
	var admin TenantAdminResponse

	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return admin, err
	}

	adminID := uuid.NewString()
	loginName := tenantID + "_" + username

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return admin, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status)
		VALUES ($1, $2, NULL, NULL, NULL, 'school', 'portal', $3, $4, $5, $6, NULL, NULL, NULL,
			NULL, NULL, NULL, '{}', '{}', 'active')
	`, adminID, tenantID, loginName, username, string(hash), name); err != nil {
		return admin, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO user_roles (id, user_id, role_id)
		SELECT $1, $2, id FROM roles WHERE tenant_id = $3 AND code = 'school_admin' LIMIT 1
	`, uuid.NewString(), adminID, tenantID); err != nil {
		return admin, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE roles SET user_count = user_count + 1
		WHERE tenant_id = $1 AND code = 'school_admin'
	`, tenantID); err != nil {
		return admin, err
	}

	if err := tx.Commit(ctx); err != nil {
		return admin, err
	}

	return h.fetchTenantAdmin(ctx, tenantID, adminID)
}

func (h *TenantHandler) fetchTenantAdmin(ctx context.Context, tenantID, adminID string) (TenantAdminResponse, error) {
	var admin TenantAdminResponse
	var loginName *string
	var lastLoginAt *time.Time
	err := h.DB.QueryRow(ctx, `
		SELECT u.id, u.tenant_id, u.username, u.login_name, u.name, u.status, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.id = $1 AND u.tenant_id = $2 AND r.code = 'school_admin'
	`, adminID, tenantID).Scan(
		&admin.ID, &admin.TenantID, &admin.Username, &loginName, &admin.Name, &admin.Status, &lastLoginAt, &admin.CreatedAt, &admin.UpdatedAt,
	)
	if err != nil {
		return admin, err
	}
	if loginName != nil {
		admin.LoginName = *loginName
	}
	admin.LastLoginAt = lastLoginAt
	return admin, nil
}
