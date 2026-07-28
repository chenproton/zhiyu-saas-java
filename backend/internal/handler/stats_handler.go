package handler

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
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
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	respondJSON(w, http.StatusOK, DashboardStats{})
}

func (h *StatsHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]float64{
		"platformFeeRate":     0.15,
		"minWithdrawalAmount": 100,
		"creditHoursRatio":    16,
	})
}

func (h *StatsHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	if !requireOperator(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *StatsHandler) MyStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"balance":     0,
		"totalIncome": 0,
		"totalSpent":  0,
	})
}
