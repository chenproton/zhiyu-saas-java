package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type AffairsTermHandler struct {
	DB *pgxpool.Pool
}

type TermListResponse struct {
	Items []domain.Term `json:"items"`
	Total int           `json:"total"`
}

type TermRequest struct {
	Name       string `json:"name"`
	StartDate  string `json:"startDate"`
	EndDate    string `json:"endDate"`
	WeeksCount int    `json:"weeksCount"`
	IsCurrent  bool   `json:"isCurrent"`
}

func (h *AffairsTermHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.Term]{
		Table:         "terms",
		SelectColumns: "id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, weeks_count, is_current, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "start_date DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if isCurrent := r.URL.Query().Get("isCurrent"); isCurrent == "true" {
				qb.addCondition("is_current = true")
			}
		},
		ScanRows: scanTermRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询学期列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询学期列表失败")
		return
	}

	respondJSON(w, http.StatusOK, TermListResponse{Items: items, Total: total})
}

func (h *AffairsTermHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req TermRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.StartDate == "" || req.EndDate == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.WeeksCount <= 0 {
		req.WeeksCount = 16
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	err := withTx(r.Context(), h.DB, func(tx pgx.Tx) error {
		if req.IsCurrent {
			if _, err := tx.Exec(r.Context(), `UPDATE terms SET is_current = false WHERE tenant_id = $1`, tenantID); err != nil {
				return err
			}
		}
		_, err := tx.Exec(r.Context(), `
			INSERT INTO terms (id, tenant_id, name, start_date, end_date, weeks_count, is_current)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, id, tenantID, req.Name, req.StartDate, req.EndDate, req.WeeksCount, req.IsCurrent)
		return err
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "学期已存在")
			return
		}
		slog.Error("创建学期失败", "error", err)
		respondError(w, http.StatusInternalServerError, "创建学期失败")
		return
	}

	term, _ := h.fetchTerm(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, term)
}

func (h *AffairsTermHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.fetchTerm(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}

	var req TermRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.StartDate == "" || req.EndDate == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.WeeksCount <= 0 {
		req.WeeksCount = 16
	}

	err := withTx(r.Context(), h.DB, func(tx pgx.Tx) error {
		if req.IsCurrent {
			if _, err := tx.Exec(r.Context(), `UPDATE terms SET is_current = false WHERE tenant_id = $1 AND id <> $2`, tenantID, id); err != nil {
				return err
			}
		}
		_, err := tx.Exec(r.Context(), `
			UPDATE terms SET name = $1, start_date = $2, end_date = $3, weeks_count = $4, is_current = $5
			WHERE id = $6 AND tenant_id = $7
		`, req.Name, req.StartDate, req.EndDate, req.WeeksCount, req.IsCurrent, id, tenantID)
		return err
	})
	if err != nil {
		slog.Error("更新学期失败", "error", err)
		respondError(w, http.StatusInternalServerError, "更新学期失败")
		return
	}

	term, _ := h.fetchTerm(r.Context(), id, tenantID)
	respondJSON(w, http.StatusOK, term)
}

func (h *AffairsTermHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.fetchTerm(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM terms WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "该学期已被教学计划或排课引用，无法删除")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AffairsTermHandler) fetchTerm(ctx context.Context, id, tenantID string) (domain.Term, error) {
	var term domain.Term
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, to_char(start_date, 'YYYY-MM-DD'), to_char(end_date, 'YYYY-MM-DD'), weeks_count, is_current, created_at
		FROM terms WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&term.ID, &term.Name, &term.StartDate, &term.EndDate, &term.WeeksCount, &term.IsCurrent, &term.CreatedAt)
	return term, err
}

func scanTermRows(rows pgx.Rows) ([]domain.Term, error) {
	items := make([]domain.Term, 0)
	for rows.Next() {
		var term domain.Term
		if err := rows.Scan(&term.ID, &term.Name, &term.StartDate, &term.EndDate, &term.WeeksCount, &term.IsCurrent, &term.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, term)
	}
	return items, nil
}
