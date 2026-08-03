package handler

import (
	"context"
	"errors"
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
		respondServerError(w, r, err, "查询角色列表失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.Role]{Items: items, Total: total})
}

// crud 返回角色 CRUD 差异配置；流程骨架由 crudCreate/crudGet/crudUpdate/crudDelete 统一实现。
func (h *RoleHandler) crud() crudConfig[CreateRoleRequest, domain.Role] {
	return crudConfig[CreateRoleRequest, domain.Role]{
		NotFoundMsg:        "角色不存在",
		CreateErrMsg:       "创建角色失败",
		UpdateErrMsg:       "更新角色失败",
		DeleteErrMsg:       "删除角色失败",
		Permit:             func(r *http.Request) bool { return canManagePortal(middleware.CurrentUser(r)) },
		UniqueViolationMsg: "角色代码已存在，请使用其他代码",
		CheckOwnership:     true,
		GetOwnership:       true,
		ValidateCreate: func(t *CreateRoleRequest) string {
			if t.TenantID == "" || t.Code == "" || t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateTenantFn: func(w http.ResponseWriter, r *http.Request, t *CreateRoleRequest) (string, bool) {
			return t.TenantID, verifyRequestTenant(w, r, t.TenantID)
		},
		ValidateUpdate: func(t *CreateRoleRequest) string {
			if t.Name == "" {
				return "缺少必填字段"
			}
			return ""
		},
		CreateFn: func(ctx context.Context, t *CreateRoleRequest, tenantID, userID string) (string, error) {
			return h.Store.Create(ctx, store.RoleCreateParams{
				TenantID:    tenantID,
				Code:        t.Code,
				Name:        t.Name,
				Description: t.Description,
				Permissions: t.Permissions,
			})
		},
		UpdateFn: func(ctx context.Context, id, _ string, t *CreateRoleRequest) error {
			return h.Store.Update(ctx, id, store.RoleUpdateParams{
				Name:        t.Name,
				Description: t.Description,
				Permissions: t.Permissions,
			})
		},
		DeleteFn: func(ctx context.Context, id, _ string) error {
			return h.Store.Delete(ctx, id)
		},
		GetByIDFn: func(ctx context.Context, id, _ string) (domain.Role, error) {
			return h.Store.GetByID(ctx, id)
		},
		TenantIDFn: func(t *domain.Role) string { return t.TenantID },
	}
}

func (h *RoleHandler) Get(w http.ResponseWriter, r *http.Request) {
	crudGet(w, r, h.crud())
}

func (h *RoleHandler) Create(w http.ResponseWriter, r *http.Request) {
	crudCreate(w, r, h.crud())
}

func (h *RoleHandler) Update(w http.ResponseWriter, r *http.Request) {
	crudUpdate(w, r, h.crud())
}

func (h *RoleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	crudDelete(w, r, h.crud())
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

	userTenantID, err := h.Store.UserTenantID(r.Context(), req.UserID)
	if err != nil {
		respondError(w, http.StatusNotFound, "用户不存在")
		return
	}
	if !verifyTenantOwnership(w, r, userTenantID) {
		return
	}

	if err := h.Store.Assign(r.Context(), role.TenantID, id, req.UserID); err != nil {
		respondServerError(w, r, err, "分配角色失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"roleId": id, "userId": req.UserID})
}
