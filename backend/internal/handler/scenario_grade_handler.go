package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ScenarioGradeHandler struct {
	DB *pgxpool.Pool
}

type ScenarioGradeMappingListResponse struct {
	Items []domain.ScenarioGradeMapping `json:"items"`
	Total int                           `json:"total"`
}

type UpsertScenarioGradeMappingRequest struct {
	ID          string  `json:"id"`
	ScenarioID  string  `json:"scenarioId"`
	TaskID      *string `json:"taskId"`
	Level       string  `json:"level"`
	MinScore    float64 `json:"minScore"`
	MaxScore    float64 `json:"maxScore"`
	Description *string `json:"description"`
	Color       *string `json:"color"`
}

func (h *ScenarioGradeHandler) ListGradeMappings(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	cfg := listQueryConfig[domain.ScenarioGradeMapping]{
		Table:         "scenario_grade_mappings",
		SelectColumns: "id, scenario_id, task_id, level, min_score, max_score, description, color",
		TenantScoped:  true,
		OrderBy:       "min_score ASC",
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if scenarioID := r.URL.Query().Get("scenarioId"); scenarioID != "" {
				qb.addCondition("scenario_id = " + qb.nextArg(scenarioID))
			}
			if taskID := r.URL.Query().Get("taskId"); taskID != "" {
				qb.addCondition("task_id = " + qb.nextArg(taskID))
			}
		},
		ScanRows: h.scanGradeMappingRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if err.Error() == "missing tenant" {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, ScenarioGradeMappingListResponse{Items: items, Total: total})
}

func (h *ScenarioGradeHandler) UpsertGradeMapping(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req UpsertScenarioGradeMappingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.ScenarioID == "" || req.Level == "" {
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
			UPDATE scenario_grade_mappings SET scenario_id = $1, task_id = $2, level = $3,
				min_score = $4, max_score = $5, description = $6, color = $7
			WHERE id = $8
		`, req.ScenarioID, req.TaskID, req.Level, req.MinScore, req.MaxScore, req.Description, req.Color, req.ID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "更新成绩映射失败")
			return
		}
		id = req.ID
	} else {
		err := h.DB.QueryRow(r.Context(), `
			INSERT INTO scenario_grade_mappings (tenant_id, scenario_id, task_id, level, min_score, max_score, description, color)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id
		`, tenantID, req.ScenarioID, req.TaskID, req.Level, req.MinScore, req.MaxScore, req.Description, req.Color).Scan(&id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "创建成绩映射失败")
			return
		}
	}

	var m domain.ScenarioGradeMapping
	_ = h.DB.QueryRow(r.Context(), `
		SELECT id, scenario_id, task_id, level, min_score, max_score, description, color
		FROM scenario_grade_mappings WHERE id = $1
	`, id).Scan(&m.ID, &m.ScenarioID, &m.TaskID, &m.Level, &m.MinScore, &m.MaxScore, &m.Description, &m.Color)
	respondJSON(w, http.StatusOK, m)
}

func (h *ScenarioGradeHandler) DeleteGradeMapping(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `DELETE FROM scenario_grade_mappings WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除成绩映射失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ScenarioGradeHandler) scanGradeMappingRows(rows pgx.Rows) ([]domain.ScenarioGradeMapping, error) {
	items := make([]domain.ScenarioGradeMapping, 0)
	for rows.Next() {
		var m domain.ScenarioGradeMapping
		if err := rows.Scan(&m.ID, &m.ScenarioID, &m.TaskID, &m.Level, &m.MinScore, &m.MaxScore, &m.Description, &m.Color); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, nil
}
