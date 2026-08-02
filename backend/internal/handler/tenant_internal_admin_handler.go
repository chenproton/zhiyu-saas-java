package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// ListSchoolAdmins lists all school_admin users for the current tenant.
func (h *TenantHandler) ListSchoolAdmins(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	items, err := h.AdminService.List(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询管理员失败")
		return
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
		respondServerError(w, r, err, "创建管理员失败")
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
		respondServerError(w, r, err, "更新管理员失败")
		return
	}

	updated, _ := h.AdminService.Get(r.Context(), tenantID, adminID)
	respondJSON(w, http.StatusOK, updated)
}

// DeleteSchoolAdmin deletes a school admin user within current tenant.
func (h *TenantHandler) DeleteSchoolAdmin(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	adminID := chi.URLParam(r, "id")

	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	if err := h.AdminService.Delete(r.Context(), tenantID, adminID); err != nil {
		respondServerError(w, r, err, "删除管理员失败")
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

	if _, err := h.AdminService.Get(r.Context(), tenantID, adminID); err != nil {
		respondError(w, http.StatusNotFound, "管理员不存在")
		return
	}

	newPassword, err := h.AdminService.ResetPassword(r.Context(), adminID)
	if err != nil {
		respondServerError(w, r, err, "保存password失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": adminID, "newPassword": newPassword})
}

// PreviewSchoolAdminPassword is an alias for ResetSchoolAdminPassword.
func (h *TenantHandler) PreviewSchoolAdminPassword(w http.ResponseWriter, r *http.Request) {
	h.ResetSchoolAdminPassword(w, r)
}
