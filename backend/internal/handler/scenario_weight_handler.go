package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ScenarioWeightHandler struct {
	DB *pgxpool.Pool
}

type ScenarioWeightListResponse struct {
	Items []domain.ScenarioWeightConfig `json:"items"`
	Total int                           `json:"total"`
}

type UpsertScenarioWeightRequest struct {
	ID         string  `json:"id"`
	ScenarioID string  `json:"scenarioId"`
	TaskID     string  `json:"taskId"`
	Weight     float64 `json:"weight"`
}

func (h *ScenarioWeightHandler) ListWeights(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	scenarioID := r.URL.Query().Get("scenarioId")
	taskID := r.URL.Query().Get("taskId")
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
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if scenarioID != "" {
		where = append(where, "scenario_id = $"+itoa(argIdx))
		args = append(args, scenarioID)
		argIdx++
	}
	if taskID != "" {
		where = append(where, "task_id = $"+itoa(argIdx))
		args = append(args, taskID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM scenario_weight_configs WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, scenario_id, task_id, weight
		FROM scenario_weight_configs
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY id DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list weights")
		return
	}
	defer rows.Close()

	items, err := h.scanWeightRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan weights")
		return
	}

	respondJSON(w, http.StatusOK, ScenarioWeightListResponse{Items: items, Total: total})
}

func (h *ScenarioWeightHandler) UpsertWeight(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req UpsertScenarioWeightRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.ScenarioID == "" || req.TaskID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var id string
	if req.ID != "" {
		_, err := h.DB.Exec(r.Context(), `
			UPDATE scenario_weight_configs SET scenario_id = $1, task_id = $2, weight = $3 WHERE id = $4
		`, req.ScenarioID, req.TaskID, req.Weight, req.ID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to update weight")
			return
		}
		id = req.ID
	} else {
		err := h.DB.QueryRow(r.Context(), `
			INSERT INTO scenario_weight_configs (tenant_id, scenario_id, task_id, weight)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (scenario_id, task_id) DO UPDATE SET weight = EXCLUDED.weight
			RETURNING id
		`, tenantID, req.ScenarioID, req.TaskID, req.Weight).Scan(&id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to upsert weight")
			return
		}
	}

	var wgt domain.ScenarioWeightConfig
	_ = h.DB.QueryRow(r.Context(), `SELECT id, scenario_id, task_id, weight FROM scenario_weight_configs WHERE id = $1`, id).Scan(
		&wgt.ID, &wgt.ScenarioID, &wgt.TaskID, &wgt.Weight,
	)
	respondJSON(w, http.StatusOK, wgt)
}

func (h *ScenarioWeightHandler) scanWeightRows(rows pgx.Rows) ([]domain.ScenarioWeightConfig, error) {
	items := make([]domain.ScenarioWeightConfig, 0)
	for rows.Next() {
		var w domain.ScenarioWeightConfig
		if err := rows.Scan(&w.ID, &w.ScenarioID, &w.TaskID, &w.Weight); err != nil {
			return nil, err
		}
		items = append(items, w)
	}
	return items, nil
}
