package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

// ListSchoolAdmins lists all school_admin users for the current tenant.
func (h *TenantHandler) ListSchoolAdmins(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
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
		respondError(w, http.StatusInternalServerError, "查询管理员失败")
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

// CreateSchoolAdmin creates a new school admin for the current tenant with a random password.
func (h *TenantHandler) CreateSchoolAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateTenantAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	plainPassword, err := generateSecurePassword(12)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "生成password失败")
		return
	}

	admin, err := h.createTenantAdmin(r.Context(), tenantID, req.Username, req.Name, plainPassword)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建管理员失败")
		return
	}

	admin.NewPassword = plainPassword
	respondJSON(w, http.StatusCreated, admin)
}

// UpdateSchoolAdmin updates a school admin's username and name within current tenant.
func (h *TenantHandler) UpdateSchoolAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	adminID := chi.URLParam(r, "id")

	existing, err := h.fetchTenantAdmin(r.Context(), tenantID, adminID)
	if err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	var req UpdateTenantAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
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
		respondError(w, http.StatusInternalServerError, "更新管理员失败")
		return
	}

	updated, _ := h.fetchTenantAdmin(r.Context(), tenantID, adminID)
	_ = existing
	respondJSON(w, http.StatusOK, updated)
}

// DeleteSchoolAdmin deletes a school admin user within current tenant.
func (h *TenantHandler) DeleteSchoolAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenantAdmin(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `
		UPDATE roles SET user_count = GREATEST(user_count - 1, 0)
		WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = $1)
	`, adminID); err != nil {
		respondError(w, http.StatusInternalServerError, "更新角色数量失败")
		return
	}

	if _, err := tx.Exec(r.Context(), `DELETE FROM user_roles WHERE user_id = $1`, adminID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除用户角色失败")
		return
	}

	if _, err := tx.Exec(r.Context(), `
		UPDATE tenants SET admin_ids = array_remove(admin_ids, $1::UUID)
		WHERE id = $2
	`, adminID, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "更新租户管理员失败")
		return
	}

	if _, err := tx.Exec(r.Context(), `DELETE FROM users WHERE id = $1 AND tenant_id = $2`, adminID, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除管理员失败")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "deleted": "true"})
}

// ResetSchoolAdminPassword resets a school admin's password and returns the new one.
func (h *TenantHandler) ResetSchoolAdminPassword(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenantAdmin(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	newPassword, err := generateSecurePassword(12)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "生成password失败")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "哈希password失败")
		return
	}

	if _, err := h.DB.Exec(r.Context(), `
		UPDATE users SET password_hash = $1, updated_at = NOW()
		WHERE id = $2
	`, string(hash), adminID); err != nil {
		respondError(w, http.StatusInternalServerError, "保存password失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "newPassword": newPassword})
}

// PreviewSchoolAdminPassword resets a school admin's password and returns the new one.
func (h *TenantHandler) PreviewSchoolAdminPassword(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenantAdmin(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	newPassword, err := generateSecurePassword(12)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "生成password失败")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "哈希password失败")
		return
	}

	if _, err := h.DB.Exec(r.Context(), `
		UPDATE users SET password_hash = $1, updated_at = NOW()
		WHERE id = $2
	`, string(hash), adminID); err != nil {
		respondError(w, http.StatusInternalServerError, "保存password失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "newPassword": newPassword})
}
