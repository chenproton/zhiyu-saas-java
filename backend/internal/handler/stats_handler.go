package handler

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type StatsHandler struct {
	DB *pgxpool.Pool
}

type DashboardStats struct {
	TotalInstitutions   int     `json:"totalInstitutions"`
	SchoolCount         int     `json:"schoolCount"`
	EnterpriseCount     int     `json:"enterpriseCount"`
	PendingInstitutions int     `json:"pendingInstitutions"`
	TotalResources      int     `json:"totalResources"`
	PublishedResources  int     `json:"publishedResources"`
	ReviewingResources  int     `json:"reviewingResources"`
	TotalGMV            float64 `json:"totalGMV"`
	MonthlyGMV          float64 `json:"monthlyGMV"`
	TotalOrders         int     `json:"totalOrders"`
	PendingWithdrawals  int     `json:"pendingWithdrawals"`
}

func (h *StatsHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	if !requireOperator(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var stats DashboardStats

	_ = h.DB.QueryRow(r.Context(), `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE type = 'school' AND status = 'approved'),
			COUNT(*) FILTER (WHERE type = 'enterprise' AND status = 'approved'),
			COUNT(*) FILTER (WHERE status = 'pending')
		FROM institutions
	`).Scan(&stats.TotalInstitutions, &stats.SchoolCount, &stats.EnterpriseCount, &stats.PendingInstitutions)

	_ = h.DB.QueryRow(r.Context(), `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'published'),
			COUNT(*) FILTER (WHERE status = 'reviewing')
		FROM resources
	`).Scan(&stats.TotalResources, &stats.PublishedResources, &stats.ReviewingResources)

	_ = h.DB.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(price), 0), COUNT(*) FROM orders WHERE status = 'paid'
	`).Scan(&stats.TotalGMV, &stats.TotalOrders)

	_ = h.DB.QueryRow(r.Context(), `
		SELECT COALESCE(SUM(price), 0) FROM orders WHERE status = 'paid' AND created_at >= DATE_TRUNC('month', NOW())
	`).Scan(&stats.MonthlyGMV)

	_ = h.DB.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'
	`).Scan(&stats.PendingWithdrawals)

	respondJSON(w, http.StatusOK, stats)
}

func (h *StatsHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	config := domain.PlatformConfig{CreditHoursRatio: 16}
	_ = h.DB.QueryRow(r.Context(), `SELECT value::float FROM platform_configs WHERE key = 'platform_fee_rate'`).Scan(&config.PlatformFeeRate)
	_ = h.DB.QueryRow(r.Context(), `SELECT value::float FROM platform_configs WHERE key = 'min_withdrawal_amount'`).Scan(&config.MinWithdrawalAmount)
	_ = h.DB.QueryRow(r.Context(), `SELECT value::float FROM platform_configs WHERE key = 'credit_hours_ratio'`).Scan(&config.CreditHoursRatio)
	if config.CreditHoursRatio == 0 {
		config.CreditHoursRatio = 16
	}
	respondJSON(w, http.StatusOK, config)
}

func (h *StatsHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	if !requireOperator(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var config domain.PlatformConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	_, _ = h.DB.Exec(r.Context(), `UPDATE platform_configs SET value = $1, updated_at = NOW() WHERE key = 'platform_fee_rate'`, config.PlatformFeeRate)
	_, _ = h.DB.Exec(r.Context(), `UPDATE platform_configs SET value = $1, updated_at = NOW() WHERE key = 'min_withdrawal_amount'`, config.MinWithdrawalAmount)
	if config.CreditHoursRatio > 0 {
		_, _ = h.DB.Exec(r.Context(), `UPDATE platform_configs SET value = $1, updated_at = NOW() WHERE key = 'credit_hours_ratio'`, config.CreditHoursRatio)
	}

	respondJSON(w, http.StatusOK, config)
}

func (h *StatsHandler) MyStats(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims.InstitutionID == nil {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"balance":     0,
			"totalIncome": 0,
			"totalSpent":  0,
		})
		return
	}

	var balance, totalIncome, totalSpent float64
	_ = h.DB.QueryRow(r.Context(), `
		SELECT balance, total_income, total_spent FROM institutions WHERE id = $1
	`, *claims.InstitutionID).Scan(&balance, &totalIncome, &totalSpent)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"balance":     balance,
		"totalIncome": totalIncome,
		"totalSpent":  totalSpent,
	})
}
