package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/cache"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type ScenarioCloneHandler struct {
	Service     *service.ScenarioService
	RedisClient *redis.Client
}

type CloneScenarioRequest struct {
	Name string `json:"name"`
	Code string `json:"code"`
}

func (h *ScenarioCloneHandler) Clone(w http.ResponseWriter, r *http.Request) {
	safeHandler(w, r, "[CloneScenario]", func() {
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
			respondServerError(w, r, err, "克隆场景方案失败")
			return
		}

		scenario, err := h.Service.Get(r.Context(), newID)
		if err != nil {
			respondServerError(w, r, err, "获取cloned scenario失败")
			return
		}
		// 列表接口挂租户级 2min 缓存（routes.go cachedPublicScenarios），克隆写入后须失效，否则前端刷新仍读到旧列表
		cache.InvalidatePrefix(r.Context(), h.RedisClient, "zhiyu:"+tenantID+":public:scenarios")
		slog.Info("[CloneScenario] success", "new_scenario_id", newID, "code", newCode)
		respondJSON(w, http.StatusCreated, scenario)
	})
}
