package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AffairsTermHandler struct {
	Service *service.PositionService
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
	cfg := store.ListQueryConfig[domain.Term]{
		Table:         "terms",
		SelectColumns: "id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, weeks_count, is_current, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "start_date DESC",
		ScanRows:      store.ScanTermRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if isCurrent := p.Values["isCurrent"]; isCurrent == "true" {
				qb.AddCondition("is_current = true")
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListTerms(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询学期列表失败")
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
	id, err := h.Service.CreateTerm(r.Context(), tenantID, &store.TermParams{
		Name: req.Name, StartDate: req.StartDate, EndDate: req.EndDate,
		WeeksCount: req.WeeksCount, IsCurrent: req.IsCurrent,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "学期已存在")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建学期失败")
		return
	}
	term, _ := h.Service.GetTerm(r.Context(), id, tenantID)
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
	if _, err := h.Service.GetTerm(r.Context(), id, tenantID); err != nil {
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
	if err := h.Service.UpdateTerm(r.Context(), tenantID, id, &store.TermParams{
		Name: req.Name, StartDate: req.StartDate, EndDate: req.EndDate,
		WeeksCount: req.WeeksCount, IsCurrent: req.IsCurrent,
	}); err != nil {
		respondError(w, http.StatusInternalServerError, "更新学期失败")
		return
	}
	term, _ := h.Service.GetTerm(r.Context(), id, tenantID)
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
	if _, err := h.Service.GetTerm(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "学期不存在")
		return
	}
	if err := h.Service.DeleteTerm(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusBadRequest, "该学期已被教学计划或排课引用，无法删除")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
