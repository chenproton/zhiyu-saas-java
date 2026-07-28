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

type AbilityDomainHandler struct {
	DB *pgxpool.Pool
}

type AbilityDomainListResponse struct {
	Items []domain.AbilityDomain `json:"items"`
	Total int                    `json:"total"`
}

type CreateAbilityDomainRequest struct {
	CareerPositionID string   `json:"careerPositionId"`
	Name             string   `json:"name"`
	Description      *string  `json:"description"`
	BindingIDs       []string `json:"bindingIds"`
	SortOrder        int      `json:"sortOrder"`
}

type UpdateAbilityDomainRequest struct {
	CareerPositionID string   `json:"careerPositionId"`
	Name             string   `json:"name"`
	Description      *string  `json:"description"`
	BindingIDs       []string `json:"bindingIds"`
	SortOrder        int      `json:"sortOrder"`
}

func (h *AbilityDomainHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	careerPositionID := r.URL.Query().Get("careerPositionId")

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[domain.AbilityDomain]{
		Table:         "ability_domains",
		SelectColumns: "id, tenant_id, career_position_id, name, description, binding_ids, sort_order",
		TenantScoped:  true,
		OrderBy:       "sort_order ASC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if careerPositionID != "" {
				qb.addCondition("career_position_id = " + qb.nextArg(careerPositionID))
			}
		},
		ScanRows: h.scanDomainRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询能力域失败")
		return
	}

	respondJSON(w, http.StatusOK, AbilityDomainListResponse{Items: items, Total: total})
}

func (h *AbilityDomainHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateAbilityDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, tenantID, req.CareerPositionID, req.Name, req.Description, coalesceStringSlice(req.BindingIDs), req.SortOrder)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建能力域失败")
		return
	}

	d, _ := h.fetchDomain(r.Context(), id)
	respondJSON(w, http.StatusCreated, d)
}

func (h *AbilityDomainHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	d, err := h.fetchDomain(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力域不存在")
		return
	}
	if d.TenantID != nil && !verifyTenantOwnership(w, r, *d.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, d)
}

func (h *AbilityDomainHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	d, err := h.fetchDomain(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力域不存在")
		return
	}
	if d.TenantID != nil && !verifyTenantOwnership(w, r, *d.TenantID) {
		return
	}

	var req UpdateAbilityDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE ability_domains SET
			career_position_id = $1, name = $2, description = $3, binding_ids = $4, sort_order = $5
		WHERE id = $6
	`, req.CareerPositionID, req.Name, req.Description, coalesceStringSlice(req.BindingIDs), req.SortOrder, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新能力域失败")
		return
	}

	d, _ = h.fetchDomain(r.Context(), id)
	respondJSON(w, http.StatusOK, d)
}

func (h *AbilityDomainHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	d, err := h.fetchDomain(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力域不存在")
		return
	}
	if d.TenantID != nil && !verifyTenantOwnership(w, r, *d.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM ability_domains WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除能力域失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AbilityDomainHandler) fetchDomain(ctx context.Context, id string) (domain.AbilityDomain, error) {
	var d domain.AbilityDomain
	var tenantID, description *string
	var bindingIDs []string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, career_position_id, name, description, binding_ids, sort_order
		FROM ability_domains WHERE id = $1
	`, id).Scan(
		&d.ID, &tenantID, &d.CareerPositionID, &d.Name, &description, &bindingIDs, &d.SortOrder,
	)
	if err != nil {
		return d, err
	}
	d.TenantID = tenantID
	d.Description = description
	d.BindingIDs = bindingIDs
	return d, nil
}

func (h *AbilityDomainHandler) scanDomainRows(rows pgx.Rows) ([]domain.AbilityDomain, error) {
	items := make([]domain.AbilityDomain, 0)
	for rows.Next() {
		var d domain.AbilityDomain
		var tenantID, description *string
		var bindingIDs []string
		if err := rows.Scan(
			&d.ID, &tenantID, &d.CareerPositionID, &d.Name, &description, &bindingIDs, &d.SortOrder,
		); err != nil {
			return nil, err
		}
		d.TenantID = tenantID
		d.Description = description
		d.BindingIDs = bindingIDs
		items = append(items, d)
	}
	return items, nil
}
