package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type EvaluationMethodHandler struct {
	DB *pgxpool.Pool
}

type EvaluationMethodCategoryListResponse struct {
	Items []domain.EvaluationMethodCategory `json:"items"`
	Total int                               `json:"total"`
}

type EvaluationMethodListResponse struct {
	Items []domain.EvaluationMethod `json:"items"`
	Total int                       `json:"total"`
}

type ToggleMethodRequest struct {
	Enabled bool `json:"enabled"`
}

func (h *EvaluationMethodHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, name, sort_order FROM evaluation_method_categories ORDER BY sort_order
	`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询分类失败")
		return
	}
	defer rows.Close()

	items := make([]domain.EvaluationMethodCategory, 0)
	for rows.Next() {
		var c domain.EvaluationMethodCategory
		if err := rows.Scan(&c.ID, &c.Name, &c.Order); err != nil {
			respondError(w, http.StatusInternalServerError, "读取分类失败")
			return
		}
		items = append(items, c)
	}
	respondJSON(w, http.StatusOK, EvaluationMethodCategoryListResponse{Items: items, Total: len(items)})
}

func (h *EvaluationMethodHandler) ListMethods(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := listQueryConfig[domain.EvaluationMethod]{
		Table:         "evaluation_methods",
		SelectColumns: "id, category_id, name, enabled, sub_category_name, description, doc_link",
		TenantScoped:  true,
		OrderBy:       "name",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if categoryID := r.URL.Query().Get("categoryId"); categoryID != "" {
				qb.addCondition("category_id = " + qb.nextArg(categoryID))
			}
		},
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg, h.scanMethodRows)
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
		} else {
			respondError(w, http.StatusInternalServerError, "查询测评方式失败")
		}
		return
	}

	respondJSON(w, http.StatusOK, EvaluationMethodListResponse{Items: items, Total: total})
}

func (h *EvaluationMethodHandler) Toggle(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	var req ToggleMethodRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if _, err := h.fetchMethod(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "测评方式不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE evaluation_methods SET enabled = $1 WHERE id = $2
	`, req.Enabled, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "切换测评方式失败")
		return
	}

	method, _ := h.fetchMethod(r.Context(), id)
	respondJSON(w, http.StatusOK, method)
}

func (h *EvaluationMethodHandler) fetchMethod(ctx context.Context, id string) (domain.EvaluationMethod, error) {
	var m domain.EvaluationMethod
	var subCategoryName, description, docLink *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, category_id, name, enabled, sub_category_name, description, doc_link
		FROM evaluation_methods WHERE id = $1
	`, id).Scan(
		&m.ID, &m.CategoryID, &m.Name, &m.Enabled, &subCategoryName, &description, &docLink,
	)
	if err != nil {
		return m, err
	}
	m.SubCategoryName = subCategoryName
	m.Description = description
	m.DocLink = docLink
	return m, nil
}

func (h *EvaluationMethodHandler) scanMethodRows(rows pgx.Rows) ([]domain.EvaluationMethod, error) {
	items := make([]domain.EvaluationMethod, 0)
	for rows.Next() {
		var m domain.EvaluationMethod
		var subCategoryName, description, docLink *string
		if err := rows.Scan(
			&m.ID, &m.CategoryID, &m.Name, &m.Enabled, &subCategoryName, &description, &docLink,
		); err != nil {
			return nil, err
		}
		m.SubCategoryName = subCategoryName
		m.Description = description
		m.DocLink = docLink
		items = append(items, m)
	}
	return items, nil
}
