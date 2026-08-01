package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
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
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	scenarioID := r.URL.Query().Get("scenarioId")
	taskID := r.URL.Query().Get("taskId")

	items, total, err := executeListQuery[domain.ScenarioWeightConfig](r.Context(), h.DB, r, store.ListQueryConfig[domain.ScenarioWeightConfig]{
		Table:         "scenario_weight_configs",
		SelectColumns: "id, scenario_id, task_id, weight",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if scenarioID != "" {
				qb.AddCondition("scenario_id = " + qb.NextArg(scenarioID))
			}
			if taskID != "" {
				qb.AddCondition("task_id = " + qb.NextArg(taskID))
			}
		},
		ScanRows: h.scanWeightRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询场景权重配置列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询场景权重配置列表失败")
		return
	}

	respondJSON(w, http.StatusOK, ScenarioWeightListResponse{Items: items, Total: total})
}

func (h *ScenarioWeightHandler) UpsertWeight(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req UpsertScenarioWeightRequest
	if !decodeBody(w, r, &req) {
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
			respondError(w, http.StatusInternalServerError, "更新权重失败")
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
			respondError(w, http.StatusInternalServerError, "更新或创建权重失败")
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
