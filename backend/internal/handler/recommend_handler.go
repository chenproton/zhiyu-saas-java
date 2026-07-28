package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type RecommendHandler struct {
	DB *pgxpool.Pool
}

type RecommendListResponse struct {
	Items []domain.PositionRecommendation `json:"items"`
	Total int                             `json:"total"`
}

type CreateRecommendRequest struct {
	MajorID          *string `json:"majorId"`
	CareerPositionID string  `json:"careerPositionId"`
	PositionType     string  `json:"positionType"`
	Reason           *string `json:"reason"`
	SortOrder        int     `json:"sortOrder"`
	IsEnabled        bool    `json:"isEnabled"`
}

type UpdateRecommendRequest struct {
	MajorID          *string `json:"majorId"`
	CareerPositionID string  `json:"careerPositionId"`
	PositionType     string  `json:"positionType"`
	Reason           *string `json:"reason"`
	SortOrder        int     `json:"sortOrder"`
	IsEnabled        bool    `json:"isEnabled"`
}

func (h *RecommendHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	majorID := r.URL.Query().Get("majorId")
	careerPositionID := r.URL.Query().Get("careerPositionId")

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[domain.PositionRecommendation]{
		Table:         "position_recommendations pr LEFT JOIN majors m ON m.id = pr.major_id",
		SelectColumns: "pr.id, pr.major_id, COALESCE(m.name, '') AS major_name, pr.career_position_id, pr.position_type, pr.reason, pr.sort_order, pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at",
		TenantScoped:  true,
		TenantColumn:  "pr.tenant_id",
		OrderBy:       "pr.sort_order ASC, pr.created_at DESC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if majorID != "" {
				qb.addCondition("pr.major_id = " + qb.nextArg(majorID))
			}
			if careerPositionID != "" {
				qb.addCondition("pr.career_position_id = " + qb.nextArg(careerPositionID))
			}
		},
		ScanRows: h.scanRecommendRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询推荐失败")
		return
	}

	respondJSON(w, http.StatusOK, RecommendListResponse{Items: items, Total: total})
}

func (h *RecommendHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateRecommendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.CareerPositionID == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO position_recommendations (
			id, tenant_id, major_id, career_position_id, position_type, reason, sort_order, is_enabled, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, id, tenantID, req.MajorID, req.CareerPositionID, req.PositionType, req.Reason, req.SortOrder, req.IsEnabled, claims.UserID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建推荐失败")
		return
	}

	rec, _ := h.fetchRecommend(r.Context(), id)
	respondJSON(w, http.StatusCreated, rec)
}

func (h *RecommendHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchRecommend(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "推荐不存在")
		return
	}

	var req UpdateRecommendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.CareerPositionID == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE position_recommendations SET
			major_id = $1, career_position_id = $2, position_type = $3, reason = $4,
			sort_order = $5, is_enabled = $6, updated_at = NOW()
		WHERE id = $7
	`, req.MajorID, req.CareerPositionID, req.PositionType, req.Reason, req.SortOrder, req.IsEnabled, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新推荐失败")
		return
	}

	rec, _ := h.fetchRecommend(r.Context(), id)
	respondJSON(w, http.StatusOK, rec)
}

func (h *RecommendHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchRecommend(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "推荐不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM position_recommendations WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除推荐失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *RecommendHandler) fetchRecommend(ctx context.Context, id string) (domain.PositionRecommendation, error) {
	var rec domain.PositionRecommendation
	var reason *string

	err := h.DB.QueryRow(ctx, `
		SELECT pr.id, pr.major_id, COALESCE(m.name, '') AS major_name,
			pr.career_position_id, pr.position_type, pr.reason, pr.sort_order,
			pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at
		FROM position_recommendations pr
		LEFT JOIN majors m ON m.id = pr.major_id
		WHERE pr.id = $1
	`, id).Scan(
		&rec.ID, &rec.MajorID, &rec.MajorName, &rec.CareerPositionID, &rec.PositionType, &reason, &rec.SortOrder,
		&rec.IsEnabled, &rec.CreatedBy, &rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		return rec, err
	}
	rec.Reason = reason
	return rec, nil
}

func (h *RecommendHandler) scanRecommendRows(rows pgx.Rows) ([]domain.PositionRecommendation, error) {
	items := make([]domain.PositionRecommendation, 0)
	for rows.Next() {
		var rec domain.PositionRecommendation
		var reason *string
		if err := rows.Scan(
			&rec.ID, &rec.MajorID, &rec.MajorName, &rec.CareerPositionID, &rec.PositionType, &reason, &rec.SortOrder,
			&rec.IsEnabled, &rec.CreatedBy, &rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		rec.Reason = reason
		items = append(items, rec)
	}
	return items, nil
}
