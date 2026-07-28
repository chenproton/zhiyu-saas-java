package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type AbilityHandler struct {
	DB *pgxpool.Pool
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
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.AbilityPoint]{
		Table:         "ability_points",
		SelectColumns: "id, name, code, description, category, attributes, is_public, creator_id, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if category := r.URL.Query().Get("category"); category != "" {
				qb.addCondition("category = " + qb.nextArg(category))
			}
			if creatorID := r.URL.Query().Get("creatorId"); creatorID != "" {
				qb.addCondition("creator_id = " + qb.nextArg(creatorID))
			}
		},
		ScanRows: h.scanAbilityRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if err.Error() == "missing tenant" {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, AbilityListResponse{Items: items, Total: total})
}

func (h *AbilityHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	ability, err := h.fetchAbility(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
		return
	}
	respondJSON(w, http.StatusOK, ability)
}

func (h *AbilityHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateAbilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Name == "" || req.Category == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	creatorID := claims.UserID
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO ability_points (id, tenant_id, name, description, category, attributes, is_public, creator_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, id, tenantID, req.Name, req.Description, req.Category, coalesceStringSlice(req.Attributes), req.IsPublic, creatorID)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "能力点名称已存在，请使用其他名称")
			return
		}
		log.Printf("[AbilityHandler.Create] insert ability_points failed: %v", err)
		respondError(w, http.StatusInternalServerError, "创建能力点失败")
		return
	}

	ability, _ := h.fetchAbility(r.Context(), id)
	respondJSON(w, http.StatusCreated, ability)
}

func (h *AbilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchAbility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
		return
	}

	var req UpdateAbilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Name == "" || req.Category == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE ability_points SET name = $1, description = $2, category = $3, attributes = $4, is_public = $5
		WHERE id = $6
	`, req.Name, req.Description, req.Category, coalesceStringSlice(req.Attributes), req.IsPublic, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "能力点名称已存在，请使用其他名称")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新能力点失败")
		return
	}

	ability, _ := h.fetchAbility(r.Context(), id)
	respondJSON(w, http.StatusOK, ability)
}

func (h *AbilityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchAbility(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "能力点不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM ability_points WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除能力点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AbilityHandler) fetchAbility(ctx context.Context, id string) (domain.AbilityPoint, error) {
	var a domain.AbilityPoint
	var description *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, name, code, description, category, attributes, is_public, creator_id, created_at
		FROM ability_points WHERE id = $1
	`, id).Scan(
		&a.ID, &a.Name, &a.Code, &description, &a.Category, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt,
	)
	if err != nil {
		return a, err
	}
	a.Description = description
	return a, nil
}

func (h *AbilityHandler) scanAbilityRows(rows pgx.Rows) ([]domain.AbilityPoint, error) {
	items := make([]domain.AbilityPoint, 0)
	for rows.Next() {
		var a domain.AbilityPoint
		var description, code *string
		if err := rows.Scan(
			&a.ID, &a.Name, &code, &description, &a.Category, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		a.Description = description
		a.Code = code
		items = append(items, a)
	}
	return items, nil
}
