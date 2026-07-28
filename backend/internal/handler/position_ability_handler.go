package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type PositionAbilityHandler struct {
	DB *pgxpool.Pool
}

type PositionAbilityListResponse struct {
	Items []domain.PositionAbilityBinding `json:"items"`
	Total int                             `json:"total"`
}

type CreatePositionAbilityRequest struct {
	CareerPositionID  string   `json:"careerPositionId"`
	ResponsibilityID  string   `json:"responsibilityId"`
	AbilityPointID    string   `json:"abilityPointId"`
	Source            string   `json:"source"`
	Domain            *string  `json:"domain"`
	RequiredLevel     string   `json:"requiredLevel"`
	RubricDescription *string  `json:"rubricDescription"`
	Attributes        []string `json:"attributes"`
	Weight            float64  `json:"weight"`
}

type UpdatePositionAbilityRequest struct {
	CareerPositionID  string   `json:"careerPositionId"`
	ResponsibilityID  string   `json:"responsibilityId"`
	AbilityPointID    string   `json:"abilityPointId"`
	Source            string   `json:"source"`
	Domain            *string  `json:"domain"`
	RequiredLevel     string   `json:"requiredLevel"`
	RubricDescription *string  `json:"rubricDescription"`
	Attributes        []string `json:"attributes"`
	Weight            float64  `json:"weight"`
}

func (h *PositionAbilityHandler) ListBindings(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	careerPositionID := r.URL.Query().Get("careerPositionId")
	responsibilityID := r.URL.Query().Get("responsibilityId")
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

	if careerPositionID != "" {
		where = append(where, "career_position_id = $"+itoa(argIdx))
		args = append(args, careerPositionID)
		argIdx++
	}
	if responsibilityID != "" {
		where = append(where, "responsibility_id = $"+itoa(argIdx))
		args = append(args, responsibilityID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM position_ability_bindings WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, career_position_id, responsibility_id, ability_point_id, source,
			domain, required_level, rubric_description, attributes, weight
		FROM position_ability_bindings
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY id DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询绑定失败")
		return
	}
	defer rows.Close()

	items, err := h.scanBindingRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取绑定失败")
		return
	}

	respondJSON(w, http.StatusOK, PositionAbilityListResponse{Items: items, Total: total})
}

func (h *PositionAbilityHandler) CreateBinding(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreatePositionAbilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.CareerPositionID == "" || req.ResponsibilityID == "" || req.AbilityPointID == "" || req.RequiredLevel == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Source == "" {
		req.Source = "custom"
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO position_ability_bindings (
			id, tenant_id, career_position_id, responsibility_id, ability_point_id, source,
			domain, required_level, rubric_description, attributes, weight
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, id, tenantID, req.CareerPositionID, req.ResponsibilityID, req.AbilityPointID, req.Source,
		req.Domain, req.RequiredLevel, req.RubricDescription, coalesceStringSlice(req.Attributes), req.Weight)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建绑定失败")
		return
	}

	binding, _ := h.fetchBinding(r.Context(), id)
	respondJSON(w, http.StatusCreated, binding)
}

func (h *PositionAbilityHandler) UpdateBinding(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchBinding(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "绑定不存在")
		return
	}

	var req UpdatePositionAbilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.CareerPositionID == "" || req.ResponsibilityID == "" || req.AbilityPointID == "" || req.RequiredLevel == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE position_ability_bindings SET
			career_position_id = $1, responsibility_id = $2, ability_point_id = $3, source = $4,
			domain = $5, required_level = $6, rubric_description = $7, attributes = $8, weight = $9
		WHERE id = $10
	`, req.CareerPositionID, req.ResponsibilityID, req.AbilityPointID, req.Source,
		req.Domain, req.RequiredLevel, req.RubricDescription, coalesceStringSlice(req.Attributes), req.Weight, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新绑定失败")
		return
	}

	binding, _ := h.fetchBinding(r.Context(), id)
	respondJSON(w, http.StatusOK, binding)
}

func (h *PositionAbilityHandler) DeleteBinding(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchBinding(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "绑定不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM position_ability_bindings WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *PositionAbilityHandler) fetchBinding(ctx context.Context, id string) (domain.PositionAbilityBinding, error) {
	var b domain.PositionAbilityBinding
	var domainField, rubricDescription *string
	var attributes []string

	err := h.DB.QueryRow(ctx, `
		SELECT id, career_position_id, responsibility_id, ability_point_id, source,
			domain, required_level, rubric_description, attributes, weight
		FROM position_ability_bindings WHERE id = $1
	`, id).Scan(
		&b.ID, &b.CareerPositionID, &b.ResponsibilityID, &b.AbilityPointID, &b.Source,
		&domainField, &b.RequiredLevel, &rubricDescription, &attributes, &b.Weight,
	)
	if err != nil {
		return b, err
	}
	b.Domain = domainField
	b.RubricDescription = rubricDescription
	b.Attributes = attributes
	return b, nil
}

func (h *PositionAbilityHandler) scanBindingRows(rows pgx.Rows) ([]domain.PositionAbilityBinding, error) {
	items := make([]domain.PositionAbilityBinding, 0)
	for rows.Next() {
		var b domain.PositionAbilityBinding
		var domainField, rubricDescription *string
		var attributes []string
		if err := rows.Scan(
			&b.ID, &b.CareerPositionID, &b.ResponsibilityID, &b.AbilityPointID, &b.Source,
			&domainField, &b.RequiredLevel, &rubricDescription, &attributes, &b.Weight,
		); err != nil {
			return nil, err
		}
		b.Domain = domainField
		b.RubricDescription = rubricDescription
		b.Attributes = attributes
		items = append(items, b)
	}
	return items, nil
}
