package handler

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type LandingHandler struct {
	Service *service.PositionService
}

// ListTargetPositions 查询当前学生目标岗位（来源：人培方案排给班级的岗位）。
func (h *LandingHandler) ListTargetPositions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	effectiveTenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, err := h.Service.ListTargetPositions(r.Context(), effectiveTenantID, claims.UserID)
	if err != nil {
		respondServerError(w, r, err, "查询目标岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.CareerPosition]{
		Items: items,
		Total: len(items),
	})
}
