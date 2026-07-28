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

type AbilityHandler struct {
	DB    *pgxpool.Pool
	Store *store.AbilitiesStore
}

type AbilityListResponse struct {
	Items []domain.AbilityPoint `json:"items"`
	Total int                   `json:"total"`
}

type CreateAbilityRequest struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Category    string   `json:"category"`
	Attributes  []string `json:"attributes"`
	IsPublic    bool     `json:"isPublic"`
}

type UpdateAbilityRequest struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Category    string   `json:"category"`
	Attributes  []string `json:"attributes"`
	IsPublic    bool     `json:"isPublic"`
}

func (h *AbilityHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := listQueryConfig[domain.AbilityPoint]{
		Table:         "ability_points",
		SelectColumns: "id, name, code, description, category, attributes, is_public, creator_id, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "description"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if category := r.URL.Query().Get("category"); category != "" {
				qb.addCondition("category = " + qb.nextArg(category))
			}
		},
	}
	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg, h.Store.ScanRows)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询能力点列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询能力点列表失败")
		return
	}
	respondJSON(w, http.StatusOK, AbilityListResponse{Items: items, Total: total})
}

func (h *AbilityHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *AbilityHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateAbilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id, err := h.Store.Create(r.Context(), store.AbilityCreateParams{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Attributes:  req.Attributes,
		IsPublic:    req.IsPublic,
		CreatorID:   claims.UserID,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建能力点失败")
		return
	}

	item, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *AbilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
		return
	}

	var req UpdateAbilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if err := h.Store.Update(r.Context(), id, store.AbilityUpdateParams{
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Attributes:  req.Attributes,
		IsPublic:    req.IsPublic,
	}); err != nil {
		respondError(w, http.StatusInternalServerError, "更新能力点失败")
		return
	}

	item, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *AbilityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除能力点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
