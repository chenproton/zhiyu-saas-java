package handler

import (
	"net/http"
)

type StatsHandler struct{}

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

func (h *StatsHandler) MyStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"balance":     0,
		"totalIncome": 0,
		"totalSpent":  0,
	})
}
