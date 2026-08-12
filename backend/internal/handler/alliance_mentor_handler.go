package handler

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

// AllianceMentorHandler 校企互动：共建导师选择器数据源（本校已引入企业的专家 + 绑定账号）。
type AllianceMentorHandler struct {
	Service *service.AllianceMentorService
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
