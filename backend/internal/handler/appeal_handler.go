package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type AppealHandler struct {
	Service *service.EvaluationService
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

	cfg := store.ListQueryConfig[domain.AppealRecord]{
		Table:         "appeal_records",
		SelectColumns: "id, user_id, type, reason, status, created_at",
		TenantScoped:  true,
		ScanRows:      store.ScanAppealRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if appealType != "" {
				qb.AddCondition("type = " + qb.NextArg(appealType))
			}
			if status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListAppeals(r.Context(), params, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询申诉失败")
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
	appeal, err := h.Service.GetAppeal(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "申诉不存在")
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
	if !decodeBody(w, r, &req) {
		return
	}
	if req.UserID == "" || req.Type == "" || req.Reason == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	appeal, err := h.Service.CreateAppeal(r.Context(), tenantID, req.UserID, req.Type, req.Reason)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建申诉失败")
		return
	}
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
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Status == "" {
		respondError(w, http.StatusBadRequest, "缺少状态")
		return
	}
	appeal, err := h.Service.ProcessAppeal(r.Context(), id, req.Status)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "处理申诉失败")
		return
	}
	respondJSON(w, http.StatusOK, appeal)
}
