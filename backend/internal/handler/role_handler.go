package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type RoleHandler struct {
	Store *store.RolesStore
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
	cfg := h.Store.ListConfig()
	items, total, err := executeListQuery[domain.Role](r.Context(), h.Store.Q(), r, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询角色列表失败", "error", err)
		respondServerError(w, r, err, "查询角色列表失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.Role]{Items: items, Total: total})
}

func (h *RoleHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "角色不存在")
		return
	}
	if !verifyTenantOwnership(w, r, role.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, role)
}

func (h *RoleHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateRoleRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TenantID == "" || req.Code == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}

	id, err := h.Store.Create(r.Context(), store.RoleCreateParams{
		TenantID:    req.TenantID,
		Code:        req.Code,
		Name:        req.Name,
		Description: req.Description,
		Permissions: req.Permissions,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "角色代码已存在，请使用其他代码")
			return
		}
		respondServerError(w, r, err, "创建角色失败")
		return
	}

	role, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, role)
}

func (h *RoleHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	role, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "角色不存在")
		return
	}
	if !verifyTenantOwnership(w, r, role.TenantID) {
		return
	}

	var req UpdateRoleRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if err := h.Store.Update(r.Context(), id, store.RoleUpdateParams{
		Name:        req.Name,
		Description: req.Description,
		Permissions: req.Permissions,
	}); err != nil {
		respondServerError(w, r, err, "更新角色失败")
		return
	}

	role, _ = h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, role)
}

func (h *RoleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	role, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "角色不存在")
		return
	}
	if !verifyTenantOwnership(w, r, role.TenantID) {
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除角色失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *RoleHandler) Assign(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	role, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "角色不存在")
		return
	}
	if !verifyTenantOwnership(w, r, role.TenantID) {
		return
	}

	var req AssignRoleRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.UserID == "" {
		respondError(w, http.StatusBadRequest, "缺少用户ID")
		return
	}

	if err := h.Store.Assign(r.Context(), role.TenantID, id, req.UserID); err != nil {
		slog.Error("assign role failed", "error", err)
		respondServerError(w, r, err, "分配角色失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"roleId": id, "userId": req.UserID})
}
