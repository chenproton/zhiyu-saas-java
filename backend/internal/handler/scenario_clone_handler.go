package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type ScenarioCloneHandler struct {
	Service *service.ScenarioService
}

type CloneScenarioRequest struct {
	Name string `json:"name"`
	Code string `json:"code"`
}

func (h *ScenarioCloneHandler) Clone(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			slog.Error("[CloneScenario] panic recovered", "panic", rec, "stack", string(debug.Stack()))
			respondError(w, http.StatusInternalServerError, "服务器内部错误")
		}
	}()

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

	var req CloneScenarioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	newID, newCode, err := h.Service.CloneScenario(r.Context(), tenantID, id, req.Name, claims.UserID)
	if err != nil {
		if service.IsNotFound(err) {
			respondError(w, http.StatusNotFound, "场景方案不存在")
			return
		}
		if err == service.ErrScenarioNotInTenant {
			respondError(w, http.StatusForbidden, "权限不足")
			return
		}
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "场景方案代码已存在，请使用其他代码")
			return
		}
		slog.Error("[CloneScenario] clone failed", "scenario_id", id, "error", err)
		respondServerError(w, r, err, "克隆场景方案失败")
		return
	}

	scenario, err := h.Service.Get(r.Context(), newID)
	if err != nil {
		slog.Error("[CloneScenario] fetch cloned scenario failed", "new_id", newID, "error", err)
		respondServerError(w, r, err, "获取cloned scenario失败")
		return
	}
	slog.Info("[CloneScenario] success", "new_scenario_id", newID, "code", newCode)
	respondJSON(w, http.StatusCreated, scenario)
}
