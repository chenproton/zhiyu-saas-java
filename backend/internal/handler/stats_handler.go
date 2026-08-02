package handler

import (
	"net/http"
)

type StatsHandler struct{}

func (h *StatsHandler) MyStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"balance":     0,
		"totalIncome": 0,
		"totalSpent":  0,
	})
}
