package handler

import (
	"net/http"

	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type NodeEvaluationResultHandler struct {
	Service *service.NodeEvaluationResultService
}

func (h *NodeEvaluationResultHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	if claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	nodeID := r.URL.Query().Get("nodeId")
	if nodeID == "" {
		respondError(w, http.StatusBadRequest, "缺少节点ID")
		return
	}

	cfg := h.Service.Store().NodeEvaluationResults().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if middleware.HasRole(claims, "student") {
		params.Values["isStudent"] = "true"
		params.Values["studentUserId"] = claims.UserID
	}
	items, total, err := store.ExecuteListQuery(r.Context(), h.Service.Queryer(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询节点测评结果失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": total})
}
