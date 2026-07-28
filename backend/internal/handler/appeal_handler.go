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

type AppealHandler struct {
	DB *pgxpool.Pool
}

type AppealListResponse struct {
	Items []domain.AppealRecord `json:"items"`
	Total int                   `json:"total"`
}

type CreateAppealRequest struct {
	UserID string `json:"userId"`
	Type   string `json:"type"`
	Reason string `json:"reason"`
}

type ProcessAppealRequest struct {
	Status string  `json:"status"`
	Remark *string `json:"remark"`
}

func (h *AppealHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	appealType := r.URL.Query().Get("type")
	status := r.URL.Query().Get("status")
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

	if appealType != "" {
		where = append(where, "type = $"+itoa(argIdx))
		args = append(args, appealType)
		argIdx++
	}
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM appeal_records WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, user_id, type, reason, status, created_at
		FROM appeal_records
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list appeals")
		return
	}
	defer rows.Close()

	items, err := h.scanAppealRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan appeals")
		return
	}

	respondJSON(w, http.StatusOK, AppealListResponse{Items: items, Total: total})
}

func (h *AppealHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	appeal, err := h.fetchAppeal(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "appeal not found")
		return
	}
	respondJSON(w, http.StatusOK, appeal)
}

func (h *AppealHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateAppealRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.UserID == "" || req.Type == "" || req.Reason == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r); if !ok { return }

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO appeal_records (id, tenant_id, user_id, type, reason, status)
		VALUES ($1, $2, $3, $4, $5, 'pending')
	`, id, tenantID, req.UserID, req.Type, req.Reason)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create appeal")
		return
	}

	appeal, _ := h.fetchAppeal(r.Context(), id)
	respondJSON(w, http.StatusCreated, appeal)
}

func (h *AppealHandler) Process(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	var req ProcessAppealRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Status == "" {
		respondError(w, http.StatusBadRequest, "missing status")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE appeal_records SET status = $1 WHERE id = $2
	`, req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to process appeal")
		return
	}

	appeal, _ := h.fetchAppeal(r.Context(), id)
	respondJSON(w, http.StatusOK, appeal)
}

func (h *AppealHandler) fetchAppeal(ctx context.Context, id string) (domain.AppealRecord, error) {
	var a domain.AppealRecord
	err := h.DB.QueryRow(ctx, `
		SELECT id, user_id, type, reason, status, created_at
		FROM appeal_records WHERE id = $1
	`, id).Scan(&a.ID, &a.UserID, &a.Type, &a.Reason, &a.Status, &a.CreatedAt)
	return a, err
}

func (h *AppealHandler) scanAppealRows(rows pgx.Rows) ([]domain.AppealRecord, error) {
	items := make([]domain.AppealRecord, 0)
	for rows.Next() {
		var a domain.AppealRecord
		if err := rows.Scan(&a.ID, &a.UserID, &a.Type, &a.Reason, &a.Status, &a.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, nil
}
