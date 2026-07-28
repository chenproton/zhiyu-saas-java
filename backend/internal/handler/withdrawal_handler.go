package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type WithdrawalHandler struct {
	DB *pgxpool.Pool
}

type WithdrawalListResponse struct {
	Items []domain.Withdrawal `json:"items"`
	Total int                 `json:"total"`
}

type CreateWithdrawalRequest struct {
	Amount      float64 `json:"amount"`
	AccountType string  `json:"accountType"`
	AccountInfo string  `json:"accountInfo"`
}

type UpdateWithdrawalRequest struct {
	Status string `json:"status"`
}

func (h *WithdrawalHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	status := r.URL.Query().Get("status")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}

	if !platformAdminOnly(claims) && claims.InstitutionID != nil {
		where = append(where, "institution_id = $"+itoa(argIdx))
		args = append(args, *claims.InstitutionID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM withdrawals WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, institution_id, amount, account_type, account_info, status, handled_at, created_at
		FROM withdrawals
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询提现失败")
		return
	}
	defer rows.Close()

	items := make([]domain.Withdrawal, 0)
	for rows.Next() {
		var wd domain.Withdrawal
		if err := rows.Scan(&wd.ID, &wd.InstitutionID, &wd.Amount, &wd.AccountType, &wd.AccountInfo, &wd.Status, &wd.HandledAt, &wd.CreatedAt); err != nil {
			respondError(w, http.StatusInternalServerError, "读取提现失败")
			return
		}
		items = append(items, wd)
	}

	respondJSON(w, http.StatusOK, WithdrawalListResponse{Items: items, Total: total})
}

func (h *WithdrawalHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims.InstitutionID == nil {
		respondError(w, http.StatusForbidden, "用户未关联机构")
		return
	}

	var req CreateWithdrawalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Amount <= 0 || req.AccountType == "" || req.AccountInfo == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	minAmount := 100.0
	_ = h.DB.QueryRow(r.Context(), `SELECT value::float FROM platform_configs WHERE key = 'min_withdrawal_amount'`).Scan(&minAmount)
	if req.Amount < minAmount {
		respondError(w, http.StatusBadRequest, "金额低于最低限额")
		return
	}

	// Check balance
	var balance float64
	_ = h.DB.QueryRow(r.Context(), `SELECT balance FROM institutions WHERE id = $1`, *claims.InstitutionID).Scan(&balance)
	if balance < req.Amount {
		respondError(w, http.StatusBadRequest, "余额不足")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	id := uuid.NewString()
	_, err = tx.Exec(r.Context(), `
		INSERT INTO withdrawals (id, institution_id, amount, account_type, account_info, status, created_at)
		VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
	`, id, *claims.InstitutionID, req.Amount, req.AccountType, req.AccountInfo)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建提现失败")
		return
	}

	_, err = tx.Exec(r.Context(), `UPDATE institutions SET balance = balance - $1 WHERE id = $2`, req.Amount, *claims.InstitutionID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "扣减余额失败")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	var wd domain.Withdrawal
	_ = h.DB.QueryRow(r.Context(), `SELECT id, institution_id, amount, account_type, account_info, status, handled_at, created_at FROM withdrawals WHERE id = $1`, id).Scan(
		&wd.ID, &wd.InstitutionID, &wd.Amount, &wd.AccountType, &wd.AccountInfo, &wd.Status, &wd.HandledAt, &wd.CreatedAt)
	respondJSON(w, http.StatusCreated, wd)
}

func (h *WithdrawalHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	if !requireOperator(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	var req UpdateWithdrawalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Status != "approved" && req.Status != "paid" && req.Status != "rejected" {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	handledAt := time.Now()
	_, err := h.DB.Exec(r.Context(), `
		UPDATE withdrawals SET status = $1, handled_at = $2 WHERE id = $3
	`, req.Status, handledAt, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新提现失败")
		return
	}

	var wd domain.Withdrawal
	_ = h.DB.QueryRow(r.Context(), `SELECT id, institution_id, amount, account_type, account_info, status, handled_at, created_at FROM withdrawals WHERE id = $1`, id).Scan(
		&wd.ID, &wd.InstitutionID, &wd.Amount, &wd.AccountType, &wd.AccountInfo, &wd.Status, &wd.HandledAt, &wd.CreatedAt)
	respondJSON(w, http.StatusOK, wd)
}
