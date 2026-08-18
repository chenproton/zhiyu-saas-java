package store

import (
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// LoginLogsListConfig 返回登录日志列表查询配置，SQL 片段沉淀在 store 层。
func LoginLogsListConfig() ListQueryConfig[domain.LoginLog] {
	return ListQueryConfig[domain.LoginLog]{
		Table:         "login_logs",
		SelectColumns: "id, tenant_id, user_id, user_name, ip, location, device, status, created_at",
		TenantScoped:  true,
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if userID := p.Values["userId"]; userID != "" {
				qb.AddCondition("user_id = " + qb.NextArg(userID))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: ScanLoginLogRows,
	}
}

// OperationLogsListConfig 返回操作日志列表查询配置，SQL 片段沉淀在 store 层。
func OperationLogsListConfig() ListQueryConfig[domain.OperationLog] {
	return ListQueryConfig[domain.OperationLog]{
		Table:         "operation_logs",
		SelectColumns: "id, tenant_id, user_id, user_name, module, action, target_type, target_id, detail, ip, status, created_at",
		TenantScoped:  true,
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
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
		ScanRows: ScanOperationLogRows,
	}
}

// ScanLoginLogRows 扫描登录日志行。
func ScanLoginLogRows(rows pgx.Rows) ([]domain.LoginLog, error) {
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
	return items, rows.Err()
}

// ScanOperationLogRows 扫描操作日志行。
func ScanOperationLogRows(rows pgx.Rows) ([]domain.OperationLog, error) {
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
	return items, rows.Err()
}
