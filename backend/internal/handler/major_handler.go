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

type MajorHandler struct {
	DB *pgxpool.Pool
}

type MajorListResponse struct {
	Items []domain.Major `json:"items"`
	Total int            `json:"total"`
}

type CreateMajorRequest struct {
	TenantID string  `json:"tenantId"`
	Code     string  `json:"code"`
	Name     string  `json:"name"`
	Alias    *string `json:"alias"`
	Enabled  bool    `json:"enabled"`
}

type UpdateMajorRequest struct {
	Code    string  `json:"code"`
	Name    string  `json:"name"`
	Alias   *string `json:"alias"`
	Enabled bool    `json:"enabled"`
}

func (h *MajorHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
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

	countQuery := "SELECT COUNT(*) FROM majors WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, code, name, alias, enabled, created_at, updated_at
		FROM majors
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list majors")
		return
	}
	defer rows.Close()

	items, err := h.scanMajorRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan majors")
		return
	}

	respondJSON(w, http.StatusOK, MajorListResponse{Items: items, Total: total})
}

func (h *MajorHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	major, err := h.fetchMajor(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "major not found")
		return
	}
	if !verifyTenantOwnership(w, r, major.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, major)
}

func (h *MajorHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateMajorRequest
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
		INSERT INTO majors (id, tenant_id, code, name, alias, enabled)
		VALUES ($1, $2, $3, normalize($4, NFKC), normalize($5, NFKC), $6)
	`, id, req.TenantID, req.Code, req.Name, req.Alias, req.Enabled)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "专业代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create major")
		return
	}

	major, _ := h.fetchMajor(r.Context(), id)
	respondJSON(w, http.StatusCreated, major)
}

func (h *MajorHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	major, err := h.fetchMajor(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "major not found")
		return
	}
	if !verifyTenantOwnership(w, r, major.TenantID) {
		return
	}

	var req UpdateMajorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Code == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE majors SET code = $1, name = normalize($2, NFKC), alias = normalize($3, NFKC), enabled = $4, updated_at = NOW()
		WHERE id = $5
	`, req.Code, req.Name, req.Alias, req.Enabled, id)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "专业代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update major")
		return
	}

	major, _ = h.fetchMajor(r.Context(), id)
	respondJSON(w, http.StatusOK, major)
}

func (h *MajorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePortal(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	major, err := h.fetchMajor(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "major not found")
		return
	}
	if !verifyTenantOwnership(w, r, major.TenantID) {
		return
	}

	var userCount int
	if err := h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM users WHERE major_id = $1`,
		id,
	).Scan(&userCount); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to check major references")
		return
	}
	if userCount > 0 {
		respondError(w, http.StatusConflict, "该专业下仍有学生，请先将学生调整到其他专业")
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM majors WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete major")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *MajorHandler) fetchMajor(ctx context.Context, id string) (domain.Major, error) {
	var m domain.Major
	var alias *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, alias, enabled, created_at, updated_at
		FROM majors WHERE id = $1
	`, id).Scan(
		&m.ID, &m.TenantID, &m.Code, &m.Name, &alias, &m.Enabled, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return m, err
	}
	m.Alias = alias
	return m, nil
}

func (h *MajorHandler) scanMajorRows(rows pgx.Rows) ([]domain.Major, error) {
	items := make([]domain.Major, 0)
	for rows.Next() {
		var m domain.Major
		var alias *string
		if err := rows.Scan(
			&m.ID, &m.TenantID, &m.Code, &m.Name, &alias, &m.Enabled, &m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			return nil, err
		}
		m.Alias = alias
		items = append(items, m)
	}
	return items, nil
}
