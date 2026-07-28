package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type RoleHandler struct {
	DB    *pgxpool.Pool
	Store *store.RolesStore
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
	status := r.URL.Query().Get("status")

	items, total, err := executeListQuery[domain.Role](r.Context(), h.DB, r, listQueryConfig[domain.Role]{
		Table:         "roles",
		SelectColumns: "id, tenant_id, code, name, description, permissions, user_count, status, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
		},
		ScanRows: h.Store.ScanRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询角色列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询角色列表失败")
		return
	}

	respondJSON(w, http.StatusOK, RoleListResponse{Items: items, Total: total})
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
		respondError(w, http.StatusInternalServerError, "创建角色失败")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
		respondError(w, http.StatusInternalServerError, "更新角色失败")
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
		respondError(w, http.StatusInternalServerError, "删除角色失败")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.UserID == "" {
		respondError(w, http.StatusBadRequest, "缺少用户ID")
		return
	}

	if err := h.Store.Assign(r.Context(), role.TenantID, id, req.UserID); err != nil {
		respondError(w, http.StatusInternalServerError, "分配角色失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"roleId": id, "userId": req.UserID})
}
