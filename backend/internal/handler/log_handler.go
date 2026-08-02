package handler

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type LogHandler struct {
	Service *service.LogService
}

type LoginLogListResponse struct {
	Items []domain.LoginLog `json:"items"`
	Total int               `json:"total"`
}

type OperationLogListResponse struct {
	Items []domain.OperationLog `json:"items"`
	Total int                   `json:"total"`
}

func (h *LogHandler) LoginLogs(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.LoginLog](r.Context(), h.Service.Queryer(), r, store.ListQueryConfig[domain.LoginLog]{
		Table:         "login_logs",
		SelectColumns: "id, tenant_id, user_id, user_name, ip, location, device, status, created_at",
		TenantScoped:  true,
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if userID := p.Values["userId"]; userID != "" {
				qb.AddCondition("user_id = " + qb.NextArg(userID))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: h.scanLoginLogRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询登录日志失败")
		return
	}

	respondJSON(w, http.StatusOK, LoginLogListResponse{Items: items, Total: total})
}

func (h *LogHandler) OperationLogs(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.OperationLog](r.Context(), h.Service.Queryer(), r, store.ListQueryConfig[domain.OperationLog]{
		Table:         "operation_logs",
		SelectColumns: "id, tenant_id, user_id, user_name, module, action, target_type, target_id, detail, ip, status, created_at",
		TenantScoped:  true,
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if userID := p.Values["userId"]; userID != "" {
				qb.AddCondition("user_id = " + qb.NextArg(userID))
			}
			if module := p.Values["module"]; module != "" {
				qb.AddCondition("module = " + qb.NextArg(module))
			}
			if action := p.Values["action"]; action != "" {
				qb.AddCondition("action = " + qb.NextArg(action))
			}
		},
		ScanRows: h.scanOperationLogRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondServerError(w, r, err, "查询操作日志失败")
		return
	}

	respondJSON(w, http.StatusOK, OperationLogListResponse{Items: items, Total: total})
}

func (h *LogHandler) scanLoginLogRows(rows pgx.Rows) ([]domain.LoginLog, error) {
	items := make([]domain.LoginLog, 0)
	for rows.Next() {
		var log domain.LoginLog
		var userID, userName, ip, location, device, status *string
		if err := rows.Scan(
			&log.ID, &log.TenantID, &userID, &userName, &ip, &location, &device, &status, &log.CreatedAt,
		); err != nil {
			return nil, err
		}
		log.UserID = userID
		log.UserName = userName
		log.IP = ip
		log.Location = location
		log.Device = device
		log.Status = status
		items = append(items, log)
	}
	return items, nil
}

func (h *LogHandler) scanOperationLogRows(rows pgx.Rows) ([]domain.OperationLog, error) {
	items := make([]domain.OperationLog, 0)
	for rows.Next() {
		var log domain.OperationLog
		var userID, userName, module, targetType, targetID, detail, ip, status *string
		if err := rows.Scan(
			&log.ID, &log.TenantID, &userID, &userName, &module, &log.Action, &targetType, &targetID, &detail, &ip, &status, &log.CreatedAt,
		); err != nil {
			return nil, err
		}
		log.UserID = userID
		log.UserName = userName
		log.Module = module
		log.TargetType = targetType
		log.TargetID = targetID
		log.Detail = detail
		log.IP = ip
		log.Status = status
		items = append(items, log)
	}
	return items, nil
}
