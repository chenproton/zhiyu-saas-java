package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

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
	items, total, err := executeListQuery[domain.OrgType](r.Context(), h.DB, r, listQueryConfig[domain.OrgType]{
		Table:         "org_types",
		SelectColumns: "id, tenant_id, name, category, description, is_default, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if tenantID := r.URL.Query().Get("tenantId"); tenantID != "" {
				qb.addCondition("tenant_id = " + qb.nextArg(tenantID))
			}
			if category := r.URL.Query().Get("category"); category != "" {
				qb.addCondition("category = " + qb.nextArg(category))
			}
		},
	}, h.scanOrgTypeRows)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询组织类型失败")
		return
	}

	respondJSON(w, http.StatusOK, OrgTypeListResponse{Items: items, Total: total})
}

func (h *OrgTypeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	orgType, err := h.fetchOrgType(r.Context(), id)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
		respondError(w, http.StatusInternalServerError, "创建组织类型失败")
		return
	}

	orgType, _ := h.fetchOrgType(r.Context(), id)
	respondJSON(w, http.StatusCreated, orgType)
}

func (h *OrgTypeHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	orgType, err := h.fetchOrgType(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "组织类型不存在")
		return
	}
	if !verifyTenantOwnership(w, r, orgType.TenantID) {
		return
	}

	var req UpdateOrgTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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

	_, err = h.DB.Exec(r.Context(), `
		UPDATE org_types SET name = $1, category = $2, description = $3
		WHERE id = $4
	`, req.Name, req.Category, req.Description, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "组织类型名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新组织类型失败")
		return
	}

	orgType, _ = h.fetchOrgType(r.Context(), id)
	respondJSON(w, http.StatusOK, orgType)
}

func (h *OrgTypeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	orgType, err := h.fetchOrgType(r.Context(), id)
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

	var refCount int
	if err := h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM organizations WHERE type_id = $1`, id).Scan(&refCount); err != nil {
		respondError(w, http.StatusInternalServerError, "检查组织类型引用失败")
		return
	}
	if refCount > 0 {
		respondError(w, http.StatusConflict, "该组织类型仍被组织使用，不可删除")
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM org_types WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除组织类型失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *OrgTypeHandler) fetchOrgType(ctx context.Context, id string) (domain.OrgType, error) {
	var ot domain.OrgType
	var description *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, category, description, is_default, created_at
		FROM org_types WHERE id = $1
	`, id).Scan(
		&ot.ID, &ot.TenantID, &ot.Name, &ot.Category, &description, &ot.IsDefault, &ot.CreatedAt,
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
			&ot.ID, &ot.TenantID, &ot.Name, &ot.Category, &description, &ot.IsDefault, &ot.CreatedAt,
		); err != nil {
			return nil, err
		}
		ot.Description = description
		items = append(items, ot)
	}
	return items, nil
}
