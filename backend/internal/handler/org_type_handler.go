package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type OrgTypeHandler struct {
	DB    *pgxpool.Pool
	Store *store.OrgTypesStore
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
	items, total, err := executeListQuery[domain.OrgType](r.Context(), h.DB, r, store.ListQueryConfig[domain.OrgType]{
		Table:         "org_types",
		SelectColumns: "id, tenant_id, name, category, description, is_default, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if tenantID := p.Values["tenantId"]; tenantID != "" {
				qb.AddCondition("tenant_id = " + qb.NextArg(tenantID))
			}
			if category := p.Values["category"]; category != "" {
				qb.AddCondition("category = " + qb.NextArg(category))
			}
		},
		ScanRows: h.Store.ScanRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询组织类型失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询组织类型失败")
		return
	}

	respondJSON(w, http.StatusOK, OrgTypeListResponse{Items: items, Total: total})
}

func (h *OrgTypeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	orgType, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "组织类型不存在")
		return
	}
	if !verifyTenantOwnership(w, r, orgType.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, orgType)
}

func (h *OrgTypeHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateOrgTypeRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.TenantID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}

	if req.Category != domain.OrgTypeCategoryInternal && req.Category != domain.OrgTypeCategoryBusiness && req.Category != domain.OrgTypeCategoryExternal {
		req.Category = domain.OrgTypeCategoryInternal
	}

	id, err := h.Store.Create(r.Context(), store.OrgTypeCreateParams{
		TenantID:    req.TenantID,
		Name:        req.Name,
		Category:    string(req.Category),
		Description: req.Description,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "组织类型名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建组织类型失败")
		return
	}

	orgType, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, orgType)
}

func (h *OrgTypeHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	orgType, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "组织类型不存在")
		return
	}
	if !verifyTenantOwnership(w, r, orgType.TenantID) {
		return
	}

	var req UpdateOrgTypeRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if req.Category != domain.OrgTypeCategoryInternal && req.Category != domain.OrgTypeCategoryBusiness && req.Category != domain.OrgTypeCategoryExternal {
		respondError(w, http.StatusBadRequest, "无效分类")
		return
	}

	err = h.Store.Update(r.Context(), id, store.OrgTypeUpdateParams{
		Name:        req.Name,
		Category:    string(req.Category),
		Description: req.Description,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "组织类型名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新组织类型失败")
		return
	}

	orgType, _ = h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, orgType)
}

func (h *OrgTypeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	orgType, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "组织类型不存在")
		return
	}
	if !verifyTenantOwnership(w, r, orgType.TenantID) {
		return
	}

	if orgType.IsDefault {
		respondError(w, http.StatusConflict, "系统默认组织类型不可删除")
		return
	}

	refCount, err := h.Store.CountOrgRefs(r.Context(), id)
	if err != nil {
		respondServerError(w, r, err, "检查组织类型引用失败")
		return
	}
	if refCount > 0 {
		respondError(w, http.StatusConflict, "该组织类型仍被组织使用，不可删除")
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除组织类型失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
