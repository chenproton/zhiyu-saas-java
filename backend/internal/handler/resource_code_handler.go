package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ResourceCodeHandler struct {
	DB *pgxpool.Pool
}

type ResourceCodeListResponse struct {
	Items []domain.ResourceCode `json:"items"`
	Total int                   `json:"total"`
}

type CreateResourceCodeRequest struct {
	TenantID    string  `json:"tenantId"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Type        string  `json:"type"`
}

type UpdateResourceCodeRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Type        string  `json:"type"`
}

func (h *ResourceCodeHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	resType := r.URL.Query().Get("type")

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[domain.ResourceCode]{
		Table:         "resource_codes",
		SelectColumns: "id, tenant_id, code, name, description, type, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if tenantID != "" {
				qb.addCondition("tenant_id = " + qb.nextArg(tenantID))
			}
			if resType != "" {
				qb.addCondition("type = " + qb.nextArg(resType))
			}
		},
		ScanRows: h.scanResourceCodeRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询资源编码失败")
		return
	}

	respondJSON(w, http.StatusOK, ResourceCodeListResponse{Items: items, Total: total})
}

func (h *ResourceCodeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	resourceCode, err := h.fetchResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源编码不存在")
		return
	}
	if !verifyTenantOwnership(w, r, resourceCode.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, resourceCode)
}

func (h *ResourceCodeHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateResourceCodeRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.TenantID == "" || req.Code == "" || req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO resource_codes (id, tenant_id, code, name, description, type)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, req.TenantID, req.Code, req.Name, req.Description, req.Type)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "资源编码代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建资源编码失败")
		return
	}

	resourceCode, _ := h.fetchResourceCode(r.Context(), id)
	respondJSON(w, http.StatusCreated, resourceCode)
}

func (h *ResourceCodeHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	resourceCode, err := h.fetchResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源编码不存在")
		return
	}
	if !verifyTenantOwnership(w, r, resourceCode.TenantID) {
		return
	}

	var req UpdateResourceCodeRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE resource_codes SET name = $1, description = $2, type = $3
		WHERE id = $4
	`, req.Name, req.Description, req.Type, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新资源编码失败")
		return
	}

	resourceCode, _ = h.fetchResourceCode(r.Context(), id)
	respondJSON(w, http.StatusOK, resourceCode)
}

func (h *ResourceCodeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	resourceCode, err := h.fetchResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源编码不存在")
		return
	}
	if !verifyTenantOwnership(w, r, resourceCode.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM resource_codes WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除资源编码失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ResourceCodeHandler) fetchResourceCode(ctx context.Context, id string) (domain.ResourceCode, error) {
	var rc domain.ResourceCode
	var description *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, description, type, created_at
		FROM resource_codes WHERE id = $1
	`, id).Scan(
		&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt,
	)
	if err != nil {
		return rc, err
	}
	rc.Description = description
	return rc, nil
}

func (h *ResourceCodeHandler) scanResourceCodeRows(rows pgx.Rows) ([]domain.ResourceCode, error) {
	items := make([]domain.ResourceCode, 0)
	for rows.Next() {
		var rc domain.ResourceCode
		var description *string
		if err := rows.Scan(
			&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt,
		); err != nil {
			return nil, err
		}
		rc.Description = description
		items = append(items, rc)
	}
	return items, nil
}
