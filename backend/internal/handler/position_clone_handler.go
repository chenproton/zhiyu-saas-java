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

type PositionCloneHandler struct {
	Service     *service.PositionCloneService
	RedisClient *redis.Client
}

type ClonePositionRequest struct {
	Name string `json:"name"`
}

func (h *PositionCloneHandler) Clone(w http.ResponseWriter, r *http.Request) {
	safeHandler(w, r, "[ClonePosition]", func() {
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

		var req ClonePositionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
			respondError(w, http.StatusBadRequest, "无效请求体")
			return
		}

		newID, err := h.Service.Clone(r.Context(), tenantID, id, req.Name, claims.UserID)
		if err != nil {
			if service.IsNotFound(err) {
				respondError(w, http.StatusNotFound, "岗位不存在")
				return
			}
			if err == service.ErrPositionNotInTenant {
				respondError(w, http.StatusForbidden, "权限不足")
				return
			}
			if isUniqueViolation(err) {
				respondError(w, http.StatusConflict, "岗位名称已存在，请使用其他名称")
				return
			}
			respondServerError(w, r, err, "克隆岗位失败")
			return
		}

		pos, err := h.Service.FetchPosition(r.Context(), newID)
		if err != nil {
			respondServerError(w, r, err, "获取cloned position失败")
			return
		}
		// 列表接口挂租户级 2min 缓存（routes.go cachedPublicPositions），克隆写入后须失效，否则前端刷新仍读到旧列表
		cache.InvalidatePrefix(r.Context(), h.RedisClient, "zhiyu:"+tenantID+":public:positions")
		slog.Info("[ClonePosition] success", "new_position_id", newID)
		respondJSON(w, http.StatusCreated, pos)
	})
}
