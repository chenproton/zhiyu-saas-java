package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
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

// AdminListAdmins lists all school_admin users for a tenant.
func (h *TenantHandler) AdminListAdmins(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}

	items, err := h.AdminService.List(r.Context(), tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询管理员失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

// AdminCreateAdmin creates a new school admin for a tenant with a random password.
func (h *TenantHandler) AdminCreateAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}

	var req CreateTenantAdminRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	admin, plainPassword, err := h.AdminService.Create(r.Context(), tenantID, req.Username, req.Name)
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

// AdminUpdateAdmin updates a school admin's username and name.
func (h *TenantHandler) AdminUpdateAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}
	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	var req UpdateTenantAdminRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	err := h.AdminService.Update(r.Context(), tenantID, adminID, req.Username, req.Name)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新管理员失败")
		return
	}

	updated, err2 := h.AdminService.Get(r.Context(), tenantID, adminID)
	if err2 != nil {
		respondError(w, http.StatusInternalServerError, "获取更新后的管理员失败")
		return
	}
	respondJSON(w, http.StatusOK, updated)
}

// AdminDeleteAdmin deletes a school admin user.
func (h *TenantHandler) AdminDeleteAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}
	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	if err := h.AdminService.Delete(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusInternalServerError, "删除管理员失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "deleted": "true"})
}

// AdminResetPassword generates a new random password for a school admin.
func (h *TenantHandler) AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	tenantID := chi.URLParam(r, "tenantId")
	adminID := chi.URLParam(r, "id")

	if _, err := h.fetchTenant(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusNotFound, "租户不存在")
		return
	}
	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	newPassword, err := h.AdminService.ResetPassword(r.Context(), adminID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "保存password失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "newPassword": newPassword})
}
