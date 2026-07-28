package handler

import (
	"errors"
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type LearnRoadHandler struct {
	DB *pgxpool.Pool
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
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg, h.scanLearnRoadRows)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
		} else {
			respondError(w, http.StatusInternalServerError, "查询学习路径失败")
		}
		return
	}

	respondJSON(w, http.StatusOK, LearnRoadListResponse{Items: items, Total: total})
}

func (h *LearnRoadHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	road, err := h.fetchLearnRoad(r.Context(), id)
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

	positionUUIDs := make([]string, len(req.PositionIDs))
	for i, pid := range req.PositionIDs {
		if u, err := uuid.Parse(pid); err == nil {
			positionUUIDs[i] = u.String()
		} else {
			positionUUIDs[i] = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(pid)).String()
		}
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO learn_roads (id, tenant_id, name, description, position_ids, steps)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, req.Name, req.Description, positionUUIDs, req.Steps)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "学习路线名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建学习路径失败")
		return
	}

	road, _ := h.fetchLearnRoad(r.Context(), id)
	respondJSON(w, http.StatusCreated, road)
}

func (h *LearnRoadHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchLearnRoad(r.Context(), id)
	if err != nil {
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

	positionIDs := req.PositionIDs
	if positionIDs == nil {
		positionIDs = existing.PositionIDs
	}
	steps := req.Steps
	if steps == nil {
		steps = existing.Steps
	}

	positionUUIDs := make([]string, len(positionIDs))
	for i, pid := range positionIDs {
		if u, err := uuid.Parse(pid); err == nil {
			positionUUIDs[i] = u.String()
		} else {
			positionUUIDs[i] = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(pid)).String()
		}
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE learn_roads SET
			name = $1, description = $2, position_ids = $3, steps = $4, updated_at = NOW()
		WHERE id = $5
	`, req.Name, req.Description, positionUUIDs, steps, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "学习路线名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新学习路径失败")
		return
	}

	road, _ := h.fetchLearnRoad(r.Context(), id)
	respondJSON(w, http.StatusOK, road)
}

func (h *LearnRoadHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchLearnRoad(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "学习路径不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM learn_roads WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除学习路径失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *LearnRoadHandler) fetchLearnRoad(ctx context.Context, id string) (domain.LearnRoad, error) {
	var road domain.LearnRoad
	var description *string
	var positionIDs []string
	var steps domain.JSONSlice

	err := h.DB.QueryRow(ctx, `
		SELECT id, name, description, position_ids, steps, created_at, updated_at
		FROM learn_roads WHERE id = $1
	`, id).Scan(
		&road.ID, &road.Name, &description, &positionIDs, &steps, &road.CreatedAt, &road.UpdatedAt,
	)
	if err != nil {
		return road, err
	}
	road.Description = description
	road.PositionIDs = positionIDs
	road.Steps = steps
	return road, nil
}

func (h *LearnRoadHandler) scanLearnRoadRows(rows pgx.Rows) ([]domain.LearnRoad, error) {
	items := make([]domain.LearnRoad, 0)
	for rows.Next() {
		var road domain.LearnRoad
		var description *string
		var positionIDs []string
		var steps domain.JSONSlice
		if err := rows.Scan(
			&road.ID, &road.Name, &description, &positionIDs, &steps, &road.CreatedAt, &road.UpdatedAt,
		); err != nil {
			return nil, err
		}
		road.Description = description
		road.PositionIDs = positionIDs
		road.Steps = steps
		items = append(items, road)
	}
	return items, nil
}
