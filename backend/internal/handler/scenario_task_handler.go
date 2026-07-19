package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ScenarioTaskHandler struct {
	DB *pgxpool.Pool
}

type ScenarioTaskListResponse struct {
	Items []domain.ScenarioTask `json:"items"`
	Total int                   `json:"total"`
}

type CreateScenarioTaskRequest struct {
	ScenarioID          string           `json:"scenarioId"`
	Name                string           `json:"name"`
	Code                string           `json:"code"`
	SortOrder           int              `json:"sortOrder"`
	Description         *string          `json:"description"`
	DetailedDescription *string          `json:"detailedDescription"`
	EstimatedHours      float64          `json:"estimatedHours"`
	TaskType            string           `json:"taskType"`
	Difficulty          int              `json:"difficulty"`
	Background          *string          `json:"background"`
	DependencyIDs       []string         `json:"dependencyIds"`
	IsReferenced        bool             `json:"isReferenced"`
	SourceScenarioID    *string          `json:"sourceScenarioId"`
	KnowledgePointIDs   []string         `json:"knowledgePointIds"`
	AbilityPointIDs     []string         `json:"abilityPointIds"`
	ResourceIDs         []string         `json:"resourceIds"`
	EvalData            domain.JSONMap   `json:"evalData"`
}

type ReorderScenarioTasksRequest struct {
	ScenarioID string   `json:"scenarioId"`
	TaskIDs    []string `json:"taskIds"`
}

const taskSelectColumns = `id, scenario_id, name, code, sort_order, description, detailed_description,
	estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced, source_scenario_id,
	knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id`

const taskInsertColumns = `scenario_id, name, code, sort_order, description, detailed_description,
	estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced, source_scenario_id,
	knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id`

func (h *ScenarioTaskHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	scenarioID := r.URL.Query().Get("scenarioId")
	search := r.URL.Query().Get("search")
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

	if scenarioID != "" {
		where = append(where, "scenario_id = $"+itoa(argIdx))
		args = append(args, scenarioID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(name ILIKE $"+itoa(argIdx)+" OR code ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM scenario_tasks WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `SELECT ` + taskSelectColumns + ` FROM scenario_tasks WHERE ` +
		strings.Join(where, " AND ") + ` ORDER BY sort_order LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	defer rows.Close()

	items, err := h.scanTaskRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan tasks")
		return
	}

	respondJSON(w, http.StatusOK, ScenarioTaskListResponse{Items: items, Total: total})
}

func (h *ScenarioTaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	task, err := h.fetchTask(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "task not found")
		return
	}
	respondJSON(w, http.StatusOK, task)
}

func (h *ScenarioTaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req CreateScenarioTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ScenarioID == "" || req.Name == "" || req.Code == "" || req.TaskType == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	var tenantID *string
	_ = h.DB.QueryRow(r.Context(), `SELECT tenant_id FROM scenarios WHERE id = $1`, req.ScenarioID).Scan(&tenantID)

	_, err := h.DB.Exec(r.Context(), `INSERT INTO scenario_tasks (`+taskInsertColumns+`)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
	`, req.ScenarioID, req.Name, req.Code, req.SortOrder, req.Description, req.DetailedDescription,
		req.EstimatedHours, req.TaskType, req.Difficulty, req.Background,
		coalesceStringSlice(req.DependencyIDs), req.IsReferenced, req.SourceScenarioID,
		coalesceStringSlice(req.KnowledgePointIDs), coalesceStringSlice(req.AbilityPointIDs),
		coalesceStringSlice(req.ResourceIDs), jsonMapBytes(req.EvalData), tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	task, _ := h.fetchTaskByCode(r.Context(), req.Code)
	respondJSON(w, http.StatusCreated, task)
}

func (h *ScenarioTaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchTask(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "task not found")
		return
	}

	var req CreateScenarioTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE scenario_tasks SET scenario_id=$1, name=$2, code=$3, sort_order=$4,
			description=$5, detailed_description=$6, estimated_hours=$7, task_type=$8,
			difficulty=$9, background=$10, dependency_ids=$11, is_referenced=$12,
			source_scenario_id=$13, knowledge_point_ids=$14, ability_point_ids=$15,
			resource_ids=$16, eval_data=$17
		WHERE id=$18
	`, req.ScenarioID, req.Name, req.Code, req.SortOrder, req.Description, req.DetailedDescription,
		req.EstimatedHours, req.TaskType, req.Difficulty, req.Background,
		coalesceStringSlice(req.DependencyIDs), req.IsReferenced, req.SourceScenarioID,
		coalesceStringSlice(req.KnowledgePointIDs), coalesceStringSlice(req.AbilityPointIDs),
		coalesceStringSlice(req.ResourceIDs), jsonMapBytes(req.EvalData), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update task")
		return
	}

	task, _ := h.fetchTask(r.Context(), id)
	respondJSON(w, http.StatusOK, task)
}

func (h *ScenarioTaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchTask(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "task not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM scenario_tasks WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete task")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ScenarioTaskHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req ReorderScenarioTasksRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ScenarioID == "" {
		respondError(w, http.StatusBadRequest, "missing scenarioId")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	for i, taskID := range req.TaskIDs {
		_, err := tx.Exec(r.Context(), `
			UPDATE scenario_tasks SET sort_order = $1 WHERE id = $2 AND scenario_id = $3
		`, i, taskID, req.ScenarioID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to reorder tasks")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ScenarioTaskHandler) fetchTask(ctx context.Context, id string) (*domain.ScenarioTask, error) {
	var t domain.ScenarioTask
	err := h.DB.QueryRow(ctx, `SELECT `+taskSelectColumns+` FROM scenario_tasks WHERE id = $1`, id).Scan(
		&t.ID, &t.ScenarioID, &t.Name, &t.Code, &t.SortOrder, &t.Description, &t.DetailedDescription,
		&t.EstimatedHours, &t.TaskType, &t.Difficulty, &t.Background, &t.DependencyIDs,
		&t.IsReferenced, &t.SourceScenarioID,
		&t.KnowledgePointIDs, &t.AbilityPointIDs, &t.ResourceIDs, &t.EvalData, &t.TenantID,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (h *ScenarioTaskHandler) fetchTaskByCode(ctx context.Context, code string) (*domain.ScenarioTask, error) {
	var t domain.ScenarioTask
	err := h.DB.QueryRow(ctx, `SELECT `+taskSelectColumns+` FROM scenario_tasks WHERE code = $1`, code).Scan(
		&t.ID, &t.ScenarioID, &t.Name, &t.Code, &t.SortOrder, &t.Description, &t.DetailedDescription,
		&t.EstimatedHours, &t.TaskType, &t.Difficulty, &t.Background, &t.DependencyIDs,
		&t.IsReferenced, &t.SourceScenarioID,
		&t.KnowledgePointIDs, &t.AbilityPointIDs, &t.ResourceIDs, &t.EvalData, &t.TenantID,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (h *ScenarioTaskHandler) scanTaskRows(rows pgx.Rows) ([]domain.ScenarioTask, error) {
	items := make([]domain.ScenarioTask, 0)
	for rows.Next() {
		var t domain.ScenarioTask
		if err := rows.Scan(
			&t.ID, &t.ScenarioID, &t.Name, &t.Code, &t.SortOrder, &t.Description, &t.DetailedDescription,
			&t.EstimatedHours, &t.TaskType, &t.Difficulty, &t.Background, &t.DependencyIDs,
			&t.IsReferenced, &t.SourceScenarioID,
			&t.KnowledgePointIDs, &t.AbilityPointIDs, &t.ResourceIDs, &t.EvalData, &t.TenantID,
		); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, nil
}

func jsonMapBytes(m domain.JSONMap) []byte {
	if m == nil {
		return []byte("{}")
	}
	b, err := json.Marshal(m)
	if err != nil {
		return []byte("{}")
	}
	return b
}
