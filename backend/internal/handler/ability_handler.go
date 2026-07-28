package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

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

	category := r.URL.Query().Get("category")
	search := r.URL.Query().Get("search")
	creatorID := r.URL.Query().Get("creatorId")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if category != "" {
		where = append(where, "category = $"+itoa(argIdx))
		args = append(args, category)
		argIdx++
	}
	if search != "" {
		where = append(where, "name ILIKE $"+itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if creatorID != "" {
		where = append(where, "creator_id = $"+itoa(argIdx))
		args = append(args, creatorID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM ability_points WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, name, code, description, category, attributes, is_public, creator_id, created_at
		FROM ability_points
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询能力点失败")
		return
	}
	defer rows.Close()

	items, err := h.scanAbilityRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取能力点失败")
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
