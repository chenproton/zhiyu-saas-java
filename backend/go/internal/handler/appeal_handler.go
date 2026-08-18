package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type AppealHandler struct {
	Service *service.EvaluationService
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
	cfg := h.Service.Store().Appeals().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListAppeals(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询申诉失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AppealRecord]{Items: items, Total: total})
}

func (h *AppealHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	appealTenantID, err := h.Service.Store().Appeals().TenantID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "申诉不存在")
		return
	}
	if appealTenantID != tenantID {
		respondError(w, http.StatusNotFound, "申诉不存在")
		return
	}
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
	// 被申诉用户必须属于当前租户，防止跨租户构造申诉记录
	user, err := h.Service.Store().Users().Get(r.Context(), tenantID, req.UserID)
	if err != nil || user.TenantID == nil || *user.TenantID != tenantID {
		respondError(w, http.StatusNotFound, "用户不存在")
		return
	}
	appeal, err := h.Service.CreateAppeal(r.Context(), tenantID, req.UserID, req.Type, req.Reason)
	if err != nil {
		respondServerError(w, r, err, "创建申诉失败")
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
	if middleware.HasRole(claims, domain.RoleStudent) {
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
	if req.Status != "approved" && req.Status != "rejected" {
		respondError(w, http.StatusBadRequest, "状态仅支持 approved/rejected")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	appealTenantID, err := h.Service.Store().Appeals().TenantID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "申诉不存在")
		return
	}
	if appealTenantID != tenantID {
		respondError(w, http.StatusNotFound, "申诉不存在")
		return
	}
	appeal, err := h.Service.ProcessAppeal(r.Context(), tenantID, id, req.Status)
	if err != nil {
		respondServerError(w, r, err, "处理申诉失败")
		return
	}
	respondJSON(w, http.StatusOK, appeal)
}
