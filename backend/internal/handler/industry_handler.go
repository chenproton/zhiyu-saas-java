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

type IndustryHandler struct {
	DB    *pgxpool.Pool
	Store *store.IndustriesStore
}

type IndustryListResponse struct {
	Items []domain.Industry `json:"items"`
	Total int               `json:"total"`
}

type CreateIndustryRequest struct {
	TenantID  string  `json:"tenantId"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	ParentID  *string `json:"parentId"`
	Enabled   bool    `json:"enabled"`
	SortOrder int     `json:"sortOrder"`
}

type UpdateIndustryRequest struct {
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	ParentID  *string `json:"parentId"`
	Enabled   bool    `json:"enabled"`
	SortOrder int     `json:"sortOrder"`
}

func (h *IndustryHandler) List(w http.ResponseWriter, r *http.Request) {
	parentID := r.URL.Query().Get("parentId")
	enabledStr := r.URL.Query().Get("enabled")

	items, total, err := executeListQuery[domain.Industry](r.Context(), h.DB, r, listQueryConfig[domain.Industry]{
		Table:         "industries",
		SelectColumns: "id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		OrderBy:       "sort_order ASC, created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if parentID != "" {
				qb.addCondition("parent_id = " + qb.nextArg(parentID))
			}
			if enabledStr != "" {
				qb.addCondition("enabled = " + qb.nextArg(enabledStr == "true"))
			}
		},
		ScanRows: h.Store.ScanRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询行业列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询行业列表失败")
		return
	}

	respondJSON(w, http.StatusOK, IndustryListResponse{Items: items, Total: total})
}

func (h *IndustryHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	industry, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "行业不存在")
		return
	}
	if !verifyTenantOwnership(w, r, industry.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, industry)
}

func (h *IndustryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateIndustryRequest
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

	id, err := h.Store.Create(r.Context(), store.IndustryCreateParams{
		TenantID:  req.TenantID,
		Code:      req.Code,
		Name:      req.Name,
		ParentID:  req.ParentID,
		Enabled:   req.Enabled,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "行业代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建行业失败")
		return
	}

	industry, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, industry)
}

func (h *IndustryHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	industry, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "行业不存在")
		return
	}
	if !verifyTenantOwnership(w, r, industry.TenantID) {
		return
	}

	var req UpdateIndustryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Code == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	err = h.Store.Update(r.Context(), id, store.IndustryUpdateParams{
		Code:      req.Code,
		Name:      req.Name,
		ParentID:  req.ParentID,
		Enabled:   req.Enabled,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "行业代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新行业失败")
		return
	}

	industry, _ = h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, industry)
}

func (h *IndustryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	industry, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "行业不存在")
		return
	}
	if !verifyTenantOwnership(w, r, industry.TenantID) {
		return
	}

	childCount, err := h.Store.CountChildren(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "检查子行业失败")
		return
	}
	if childCount > 0 {
		respondError(w, http.StatusConflict, "该行业下仍有子行业，请先删除子行业")
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除行业失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
