package handler

import (
	"errors"
	"net/http"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type LogHandler struct {
	Service *service.LogService
}

func (h *LogHandler) LoginLogs(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.LoginLog](r.Context(), h.Service.Queryer(), r, store.LoginLogsListConfig())
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询登录日志失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.LoginLog]{Items: items, Total: total})
}

func (h *LogHandler) OperationLogs(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.OperationLog](r.Context(), h.Service.Queryer(), r, store.OperationLogsListConfig())
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询操作日志失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.OperationLog]{Items: items, Total: total})
}
