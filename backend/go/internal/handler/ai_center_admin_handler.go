// AI 智能服务中心管理端 HTTP 适配（spec §5.4；路由层 RequireRole(school_admin)）。
package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/service"
)

// AICenterAdminHandler 管理端 handler（school_admin）。
type AICenterAdminHandler struct {
	Service *service.AICenterService
}

// ListReviews GET /ai/admin/reviews?type=kb|agent&status=&page=
func (h *AICenterAdminHandler) ListReviews(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	page, pageSize := aiCenterPage(r)
	res, err := h.Service.ListReviews(r.Context(), tenantID,
		r.URL.Query().Get("type"), r.URL.Query().Get("status"), page, pageSize)
	if errors.Is(err, service.ErrAIReviewBadType) {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if aiCenterError(w, r, err, "查询审核列表失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, res)
}

type reviewActionRequest struct {
	Comment string `json:"comment"`
}

// ReviewAction POST /ai/admin/reviews/{type}/{id}/{action}（approve/reject/takedown）
func (h *AICenterAdminHandler) ReviewAction(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var req reviewActionRequest
	if r.Body != nil && r.ContentLength > 0 {
		if !decodeBody(w, r, &req) {
			return
		}
	}
	targetType := chi.URLParam(r, "type")
	targetID := chi.URLParam(r, "id")
	action := chi.URLParam(r, "action")
	err := h.Service.ReviewAction(r.Context(), tenantID, userID, targetType, targetID, action, strings.TrimSpace(req.Comment))
	if errors.Is(err, service.ErrAIReviewBadType) || errors.Is(err, service.ErrAIReviewBadAction) || errors.Is(err, service.ErrAIRejectCommentRequired) {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if aiCenterError(w, r, err, "审核操作失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Overview GET /ai/admin/overview
func (h *AICenterAdminHandler) Overview(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	stats, err := h.Service.AdminOverview(r.Context(), tenantID)
	if aiCenterError(w, r, err, "查询统计失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, stats)
}

// ==================== 第三方挂接 ====================

// ListIntegrations GET /ai/admin/integrations?kind=（含 inactive）
func (h *AICenterAdminHandler) ListIntegrations(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	items, err := h.Service.ListIntegrations(r.Context(), tenantID, r.URL.Query().Get("kind"), false)
	if aiCenterError(w, r, err, "查询挂接失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items})
}

// CreateIntegration POST /ai/admin/integrations
func (h *AICenterAdminHandler) CreateIntegration(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var in service.IntegrationInput
	if !decodeBody(w, r, &in) {
		return
	}
	it, err := h.Service.CreateIntegration(r.Context(), tenantID, userID, in)
	if errors.Is(err, service.ErrAIIntegrationInvalid) {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if aiCenterError(w, r, err, "创建挂接失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusCreated, it)
}

// UpdateIntegration PUT /ai/admin/integrations/{id}
func (h *AICenterAdminHandler) UpdateIntegration(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var in service.IntegrationInput
	if !decodeBody(w, r, &in) {
		return
	}
	err := h.Service.UpdateIntegration(r.Context(), tenantID, chi.URLParam(r, "id"), in)
	if errors.Is(err, service.ErrAIIntegrationInvalid) {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if aiCenterError(w, r, err, "更新挂接失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type integrationToggleRequest struct {
	Status string `json:"status"`
}

// ToggleIntegration POST /ai/admin/integrations/{id}/toggle
func (h *AICenterAdminHandler) ToggleIntegration(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req integrationToggleRequest
	if !decodeBody(w, r, &req) {
		return
	}
	err := h.Service.ToggleIntegration(r.Context(), tenantID, chi.URLParam(r, "id"), req.Status)
	if errors.Is(err, service.ErrAIIntegrationInvalid) {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if aiCenterError(w, r, err, "切换状态失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DeleteIntegration DELETE /ai/admin/integrations/{id}
func (h *AICenterAdminHandler) DeleteIntegration(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	err := h.Service.DeleteIntegration(r.Context(), tenantID, chi.URLParam(r, "id"))
	if aiCenterError(w, r, err, "删除挂接失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
