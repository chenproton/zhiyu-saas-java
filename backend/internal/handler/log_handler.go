package handler

import (
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type LogHandler struct {
	DB *pgxpool.Pool
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
	userID := r.URL.Query().Get("userId")
	status := r.URL.Query().Get("status")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if userID != "" {
		where = append(where, "user_id = $"+itoa(argIdx))
		args = append(args, userID)
		argIdx++
	}
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM login_logs WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, user_id, user_name, ip, location, device, status, created_at
		FROM login_logs
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list login logs")
		return
	}
	defer rows.Close()

	items, err := h.scanLoginLogRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan login logs")
		return
	}

	respondJSON(w, http.StatusOK, LoginLogListResponse{Items: items, Total: total})
}

func (h *LogHandler) OperationLogs(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	module := r.URL.Query().Get("module")
	action := r.URL.Query().Get("action")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if userID != "" {
		where = append(where, "user_id = $"+itoa(argIdx))
		args = append(args, userID)
		argIdx++
	}
	if module != "" {
		where = append(where, "module = $"+itoa(argIdx))
		args = append(args, module)
		argIdx++
	}
	if action != "" {
		where = append(where, "action = $"+itoa(argIdx))
		args = append(args, action)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM operation_logs WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, user_id, user_name, module, action, target_type, target_id, detail, ip, status, created_at
		FROM operation_logs
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list operation logs")
		return
	}
	defer rows.Close()

	items, err := h.scanOperationLogRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan operation logs")
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
