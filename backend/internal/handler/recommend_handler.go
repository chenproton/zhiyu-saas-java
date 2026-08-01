package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type RecommendHandler struct {
	Service *service.PositionService
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
	cfg := store.ListQueryConfig[domain.PositionRecommendation]{
		Table:         "position_recommendations pr LEFT JOIN majors m ON m.id = pr.major_id",
		SelectColumns: "pr.id, pr.major_id, COALESCE(m.name, '') AS major_name, pr.career_position_id, pr.position_type, pr.reason, pr.sort_order, pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at",
		TenantScoped:  true,
		TenantColumn:  "pr.tenant_id",
		OrderBy:       "pr.sort_order ASC, pr.created_at DESC",
		ScanRows:      store.ScanRecommendRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if majorID != "" {
				qb.AddCondition("pr.major_id = " + qb.NextArg(majorID))
			}
			if careerPositionID != "" {
				qb.AddCondition("pr.career_position_id = " + qb.NextArg(careerPositionID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListRecommends(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询推荐失败")
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
	if !decodeBody(w, r, &req) {
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
	rec, err := h.Service.CreateRecommend(r.Context(), tenantID, &store.RecommendParams{
		MajorID: req.MajorID, CareerPositionID: req.CareerPositionID, PositionType: req.PositionType,
		Reason: req.Reason, SortOrder: req.SortOrder, IsEnabled: req.IsEnabled, CreatedBy: claims.UserID,
	})
	if err != nil {
		respondServerError(w, r, err, "创建推荐失败")
		return
	}
	respondJSON(w, http.StatusCreated, rec)
}

func (h *RecommendHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetRecommend(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "推荐不存在")
		return
	}
	var req UpdateRecommendRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	rec, err := h.Service.UpdateRecommend(r.Context(), id, &store.RecommendParams{
		MajorID: req.MajorID, CareerPositionID: req.CareerPositionID, PositionType: req.PositionType,
		Reason: req.Reason, SortOrder: req.SortOrder, IsEnabled: req.IsEnabled,
	})
	if err != nil {
		respondServerError(w, r, err, "更新推荐失败")
		return
	}
	respondJSON(w, http.StatusOK, rec)
}

func (h *RecommendHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetRecommend(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "推荐不存在")
		return
	}
	if err := h.Service.DeleteRecommend(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除推荐失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
