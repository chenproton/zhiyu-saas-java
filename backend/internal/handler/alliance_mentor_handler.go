package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// AllianceMentorHandler 校企互动：专家影子账号（共建导师）启用/停用/选择器数据源。
type AllianceMentorHandler struct {
	Service *service.AllianceMentorService
}

// mentorLinkResponse 启用响应；username/initialPassword 仅新建影子账号时返回一次。
type mentorLinkResponse struct {
	domain.AllianceExpertMentorLink
	Username        string `json:"username,omitempty"`
	InitialPassword string `json:"initialPassword,omitempty"`
}

// EnableMentorLink 启用专家为共建导师（POST /alliance/experts/{id}/mentor-link，幂等）。
func (h *AllianceMentorHandler) EnableMentorLink(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	result, err := h.Service.EnableMentor(r.Context(), tenantID, chi.URLParam(r, "id"), claims.UserID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrExpertNotFound):
			respondError(w, http.StatusNotFound, "专家不存在")
		case errors.Is(err, service.ErrExpertNotLinkedToSchool):
			respondError(w, http.StatusForbidden, "无权操作：该专家所属企业未引入本校")
		default:
			respondServerError(w, r, err, "启用共建导师失败")
		}
		return
	}
	resp := mentorLinkResponse{AllianceExpertMentorLink: *result.Link}
	if result.Created {
		resp.Username = result.Username
		resp.InitialPassword = result.InitialPassword
		respondJSON(w, http.StatusCreated, resp)
		return
	}
	respondJSON(w, http.StatusOK, resp)
}

// DisableMentorLink 停用导师绑定（DELETE /alliance/experts/{id}/mentor-link；不删影子账号）。
func (h *AllianceMentorHandler) DisableMentorLink(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	link, err := h.Service.DisableMentor(r.Context(), tenantID, chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "导师绑定不存在")
			return
		}
		respondServerError(w, r, err, "停用共建导师失败")
		return
	}
	respondJSON(w, http.StatusOK, link)
}

// ListMentorOptions 共建导师选择器数据源（GET /alliance/experts/mentor-options）。
func (h *AllianceMentorHandler) ListMentorOptions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageAlliance(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	items, err := h.Service.ListMentorOptions(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询共建导师列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AllianceMentorOption]{Items: items, Total: len(items)})
}
