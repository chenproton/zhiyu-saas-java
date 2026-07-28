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

type ResourceCodeHandler struct {
	DB *pgxpool.Pool
}

type ResourceCodeListResponse struct {
	Items []domain.ResourceCode `json:"items"`
	Total int                   `json:"total"`
}

type CreateResourceCodeRequest struct {
	TenantID    string  `json:"tenantId"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Type        string  `json:"type"`
}

type UpdateResourceCodeRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Type        string  `json:"type"`
}

func (h *ResourceCodeHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	resType := r.URL.Query().Get("type")
	search := r.URL.Query().Get("search")
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
	if resType != "" {
		where = append(where, "type = $"+itoa(argIdx))
		args = append(args, resType)
		argIdx++
	}
	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM resource_codes WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, code, name, description, type, created_at
		FROM resource_codes
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询资源编码失败")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceCodeRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取资源编码失败")
		return
	}

	respondJSON(w, http.StatusOK, ResourceCodeListResponse{Items: items, Total: total})
}

func (h *ResourceCodeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	resourceCode, err := h.fetchResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源编码不存在")
		return
	}
	if !verifyTenantOwnership(w, r, resourceCode.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, resourceCode)
}

func (h *ResourceCodeHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateResourceCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.TenantID == "" || req.Code == "" || req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO resource_codes (id, tenant_id, code, name, description, type)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, req.TenantID, req.Code, req.Name, req.Description, req.Type)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "资源编码代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建资源编码失败")
		return
	}

	resourceCode, _ := h.fetchResourceCode(r.Context(), id)
	respondJSON(w, http.StatusCreated, resourceCode)
}

func (h *ResourceCodeHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	resourceCode, err := h.fetchResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源编码不存在")
		return
	}
	if !verifyTenantOwnership(w, r, resourceCode.TenantID) {
		return
	}

	var req UpdateResourceCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE resource_codes SET name = $1, description = $2, type = $3
		WHERE id = $4
	`, req.Name, req.Description, req.Type, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新资源编码失败")
		return
	}

	resourceCode, _ = h.fetchResourceCode(r.Context(), id)
	respondJSON(w, http.StatusOK, resourceCode)
}

func (h *ResourceCodeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	resourceCode, err := h.fetchResourceCode(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源编码不存在")
		return
	}
	if !verifyTenantOwnership(w, r, resourceCode.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM resource_codes WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除资源编码失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ResourceCodeHandler) fetchResourceCode(ctx context.Context, id string) (domain.ResourceCode, error) {
	var rc domain.ResourceCode
	var description *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, description, type, created_at
		FROM resource_codes WHERE id = $1
	`, id).Scan(
		&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt,
	)
	if err != nil {
		return rc, err
	}
	rc.Description = description
	return rc, nil
}

func (h *ResourceCodeHandler) scanResourceCodeRows(rows pgx.Rows) ([]domain.ResourceCode, error) {
	items := make([]domain.ResourceCode, 0)
	for rows.Next() {
		var rc domain.ResourceCode
		var description *string
		if err := rows.Scan(
			&rc.ID, &rc.TenantID, &rc.Code, &rc.Name, &description, &rc.Type, &rc.CreatedAt,
		); err != nil {
			return nil, err
		}
		rc.Description = description
		items = append(items, rc)
	}
	return items, nil
}
