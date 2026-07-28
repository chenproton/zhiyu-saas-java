package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AbilityDomainHandler struct {
	DB    *pgxpool.Pool
	Store *store.AbilityDomainsStore
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
	items, total, err := executeListQuery[domain.AbilityDomain](r.Context(), h.DB, r, listQueryConfig[domain.AbilityDomain]{
		Table:         "ability_domains",
		SelectColumns: "id, career_position_id, name, description, binding_ids, sort_order",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ScanRows:      h.Store.ScanRows,
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

func (h *AbilityDomainHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力域不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *AbilityDomainHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateAbilityDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" || req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id, err := h.Store.Create(r.Context(), store.AbilityDomainCreateParams{
		TenantID:         tenantID,
		CareerPositionID: req.CareerPositionID,
		Name:             req.Name,
		Description:      req.Description,
		BindingIDs:       req.BindingIDs,
		SortOrder:        req.SortOrder,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建能力域失败")
		return
	}

	item, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *AbilityDomainHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "能力域不存在")
		return
	}

	var req UpdateAbilityDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if err := h.Store.Update(r.Context(), id, store.AbilityDomainUpdateParams{
		CareerPositionID: req.CareerPositionID,
		Name:             req.Name,
		Description:      req.Description,
		BindingIDs:       req.BindingIDs,
		SortOrder:        req.SortOrder,
	}); err != nil {
		respondError(w, http.StatusInternalServerError, "更新能力域失败")
		return
	}

	item, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *AbilityDomainHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "能力域不存在")
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除能力域失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
