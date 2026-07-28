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

type IndustryHandler struct {
	DB *pgxpool.Pool
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
	tenantID := r.URL.Query().Get("tenantId")
	parentID := r.URL.Query().Get("parentId")
	search := r.URL.Query().Get("search")
	enabledStr := r.URL.Query().Get("enabled")
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

	if tenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, tenantID)
		argIdx++
	}
	if parentID != "" {
		where = append(where, "parent_id = $"+itoa(argIdx))
		args = append(args, parentID)
		argIdx++
	}
	if enabledStr != "" {
		where = append(where, "enabled = $"+itoa(argIdx))
		args = append(args, enabledStr == "true")
		argIdx++
	}
	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM industries WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at
		FROM industries
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY sort_order ASC, created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询行业失败")
		return
	}
	defer rows.Close()

	items, err := h.scanIndustryRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取行业失败")
		return
	}

	respondJSON(w, http.StatusOK, IndustryListResponse{Items: items, Total: total})
}

func (h *IndustryHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	industry, err := h.fetchIndustry(r.Context(), id)
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

	id := uuid.NewString()

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO industries (id, tenant_id, code, name, parent_id, enabled, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, req.TenantID, req.Code, req.Name, req.ParentID, req.Enabled, req.SortOrder)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "行业代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建行业失败")
		return
	}

	industry, _ := h.fetchIndustry(r.Context(), id)
	respondJSON(w, http.StatusCreated, industry)
}

func (h *IndustryHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	industry, err := h.fetchIndustry(r.Context(), id)
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

	_, err = h.DB.Exec(r.Context(), `
		UPDATE industries SET code = $1, name = $2, parent_id = $3, enabled = $4, sort_order = $5, updated_at = NOW()
		WHERE id = $6
	`, req.Code, req.Name, req.ParentID, req.Enabled, req.SortOrder, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "行业代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "更新行业失败")
		return
	}

	industry, _ = h.fetchIndustry(r.Context(), id)
	respondJSON(w, http.StatusOK, industry)
}

func (h *IndustryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	industry, err := h.fetchIndustry(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "行业不存在")
		return
	}
	if !verifyTenantOwnership(w, r, industry.TenantID) {
		return
	}

	var childCount int
	if err := h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM industries WHERE parent_id = $1`,
		id,
	).Scan(&childCount); err != nil {
		respondError(w, http.StatusInternalServerError, "检查child industries失败")
		return
	}
	if childCount > 0 {
		respondError(w, http.StatusConflict, "该行业下仍有子行业，请先删除子行业")
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM industries WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除行业失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *IndustryHandler) fetchIndustry(ctx context.Context, id string) (domain.Industry, error) {
	var i domain.Industry
	var parentID *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at
		FROM industries WHERE id = $1
	`, id).Scan(
		&i.ID, &i.TenantID, &i.Code, &i.Name, &parentID, &i.Enabled, &i.SortOrder, &i.CreatedAt, &i.UpdatedAt,
	)
	if err != nil {
		return i, err
	}
	i.ParentID = parentID
	return i, nil
}

func (h *IndustryHandler) scanIndustryRows(rows pgx.Rows) ([]domain.Industry, error) {
	items := make([]domain.Industry, 0)
	for rows.Next() {
		var i domain.Industry
		var parentID *string
		if err := rows.Scan(
			&i.ID, &i.TenantID, &i.Code, &i.Name, &parentID, &i.Enabled, &i.SortOrder, &i.CreatedAt, &i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		i.ParentID = parentID
		items = append(items, i)
	}
	return items, nil
}
