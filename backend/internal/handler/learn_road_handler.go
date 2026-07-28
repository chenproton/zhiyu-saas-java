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

type LearnRoadHandler struct {
	DB    *pgxpool.Pool
	Store *store.LearnRoadsStore
}

type LearnRoadListResponse struct {
	Items []domain.LearnRoad `json:"items"`
	Total int                `json:"total"`
}

type CreateLearnRoadRequest struct {
	Name        string           `json:"name"`
	Description *string          `json:"description"`
	PositionIDs []string         `json:"positionIds"`
	Steps       domain.JSONSlice `json:"steps"`
}

type UpdateLearnRoadRequest struct {
	Name        string           `json:"name"`
	Description *string          `json:"description"`
	PositionIDs []string         `json:"positionIds"`
	Steps       domain.JSONSlice `json:"steps"`
}

func (h *LearnRoadHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.LearnRoad]{
		Table:         "learn_roads",
		SelectColumns: "id, name, description, position_ids, steps, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if name := r.URL.Query().Get("name"); name != "" {
				qb.addCondition("name ILIKE " + qb.nextArg("%"+name+"%"))
			}
		},
		ScanRows: h.Store.ScanRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询学习路径失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询学习路径失败")
		return
	}

	respondJSON(w, http.StatusOK, LearnRoadListResponse{Items: items, Total: total})
}

func (h *LearnRoadHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	road, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "学习路径不存在")
		return
	}
	respondJSON(w, http.StatusOK, road)
}

func (h *LearnRoadHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateLearnRoadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Steps == nil {
		req.Steps = domain.JSONSlice{}
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id, err := h.Store.Create(r.Context(), store.LearnRoadCreateParams{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		PositionIDs: req.PositionIDs,
		Steps:       req.Steps,
	})
	if err != nil {
		slog.Error("create learn road failed", "error", err)
		respondError(w, http.StatusInternalServerError, "创建学习路径失败")
		return
	}

	road, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, road)
}

func (h *LearnRoadHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "学习路径不存在")
		return
	}

	var req UpdateLearnRoadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if err := h.Store.Update(r.Context(), id, store.LearnRoadUpdateParams{
		Name:        req.Name,
		Description: req.Description,
		PositionIDs: req.PositionIDs,
		Steps:       req.Steps,
	}); err != nil {
		respondError(w, http.StatusInternalServerError, "更新学习路径失败")
		return
	}

	road, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, road)
}

func (h *LearnRoadHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetByID(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "学习路径不存在")
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除学习路径失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
