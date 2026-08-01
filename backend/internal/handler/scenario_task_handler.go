package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ScenarioTaskHandler struct {
	DB *pgxpool.Pool
}

type ScenarioTaskListResponse struct {
	Items []domain.ScenarioTask `json:"items"`
	Total int                   `json:"total"`
}

type CreateScenarioTaskRequest struct {
	ScenarioID          string         `json:"scenarioId"`
	Name                string         `json:"name"`
	Code                string         `json:"code"`
	SortOrder           int            `json:"sortOrder"`
	Description         *string        `json:"description"`
	DetailedDescription *string        `json:"detailedDescription"`
	DescriptionPdf      *string        `json:"descriptionPdf"`
	EstimatedHours      float64        `json:"estimatedHours"`
	TaskType            string         `json:"taskType"`
	Difficulty          *int           `json:"difficulty"`
	Background          *string        `json:"background"`
	DependencyIDs       []string       `json:"dependencyIds"`
	IsReferenced        bool           `json:"isReferenced"`
	SourceScenarioID    *string        `json:"sourceScenarioId"`
	KnowledgePointIDs   []string       `json:"knowledgePointIds"`
	AbilityPointIDs     []string       `json:"abilityPointIds"`
	ResourceIDs         []string       `json:"resourceIds"`
	EvalData            domain.JSONMap `json:"evalData"`
}

type ReorderScenarioTasksRequest struct {
	ScenarioID string   `json:"scenarioId"`
	TaskIDs    []string `json:"taskIds"`
}

const taskSelectColumns = `id, scenario_id, name, code, sort_order, description, detailed_description, description_pdf,
	estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced, source_scenario_id,
	knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id`

const taskInsertColumns = `scenario_id, name, code, sort_order, description, detailed_description, description_pdf,
	estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced, source_scenario_id,
	knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id`

func (h *ScenarioTaskHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	cfg := store.ListQueryConfig[domain.ScenarioTask]{
		Table:         "scenario_tasks",
		SelectColumns: taskSelectColumns,
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		OrderBy:       "sort_order",
		ScanRows:      h.scanTaskRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if scenarioID := p.Values["scenarioId"]; scenarioID != "" {
				qb.AddCondition("scenario_id = " + qb.NextArg(scenarioID))
			}
		},
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询任务失败")
		return
	}

	if len(items) > 0 {
		h.populateEvalData(r.Context(), items)
	}

	respondJSON(w, http.StatusOK, ScenarioTaskListResponse{Items: items, Total: total})
}

func (h *ScenarioTaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	task, err := h.fetchTask(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "任务不存在")
		return
	}
	if task.TenantID != nil && !verifyTenantOwnership(w, r, *task.TenantID) {
		return
	}
	h.populateEvalData(r.Context(), []domain.ScenarioTask{*task})
	respondJSON(w, http.StatusOK, task)
}

func (h *ScenarioTaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req CreateScenarioTaskRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ScenarioID == "" || req.Name == "" || req.Code == "" || req.TaskType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	var scenarioTenantID *string
	err := h.DB.QueryRow(r.Context(), `SELECT tenant_id FROM scenarios WHERE id = $1`, req.ScenarioID).Scan(&scenarioTenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "场景不存在")
		return
	}
	if scenarioTenantID != nil && !verifyTenantOwnership(w, r, *scenarioTenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `INSERT INTO scenario_tasks (`+taskInsertColumns+`)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
	`, req.ScenarioID, req.Name, req.Code, req.SortOrder, req.Description, req.DetailedDescription, req.DescriptionPdf,
		req.EstimatedHours, req.TaskType, req.Difficulty, req.Background,
		coalesceStringSlice(req.DependencyIDs), req.IsReferenced, req.SourceScenarioID,
		coalesceStringSlice(req.KnowledgePointIDs), coalesceStringSlice(req.AbilityPointIDs),
		coalesceStringSlice(req.ResourceIDs), jsonMapBytes(req.EvalData), scenarioTenantID)
	if err != nil {
		slog.Error("创建任务失败", "scenarioId", req.ScenarioID, "error", err)
		respondError(w, http.StatusInternalServerError, "创建任务失败")
		return
	}

	task, _ := h.fetchTaskByCode(r.Context(), req.Code)
	respondJSON(w, http.StatusCreated, task)
}

func (h *ScenarioTaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	task, err := h.fetchTask(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "任务不存在")
		return
	}
	if task.TenantID == nil {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if !verifyTenantOwnership(w, r, *task.TenantID) {
		return
	}

	var req CreateScenarioTaskRequest
	if !decodeBody(w, r, &req) {
		return
	}

	var newScenarioTenantID *string
	err = h.DB.QueryRow(r.Context(), `SELECT tenant_id FROM scenarios WHERE id = $1`, req.ScenarioID).Scan(&newScenarioTenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "场景不存在")
		return
	}
	if newScenarioTenantID != nil && !verifyTenantOwnership(w, r, *newScenarioTenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE scenario_tasks SET scenario_id=$1, name=$2, code=$3, sort_order=$4,
			description=$5, detailed_description=$6, description_pdf=$7, estimated_hours=$8, task_type=$9,
			difficulty=$10, background=$11, dependency_ids=$12, is_referenced=$13,
			source_scenario_id=$14, knowledge_point_ids=$15, ability_point_ids=$16,
			resource_ids=$17, eval_data=$18
		WHERE id=$19 AND tenant_id=$20
	`, req.ScenarioID, req.Name, req.Code, req.SortOrder, req.Description, req.DetailedDescription, req.DescriptionPdf,
		req.EstimatedHours, req.TaskType, req.Difficulty, req.Background,
		coalesceStringSlice(req.DependencyIDs), req.IsReferenced, req.SourceScenarioID,
		coalesceStringSlice(req.KnowledgePointIDs), coalesceStringSlice(req.AbilityPointIDs),
		coalesceStringSlice(req.ResourceIDs), jsonMapBytes(req.EvalData), id, task.TenantID)
	if err != nil {
		slog.Error("更新任务失败", "taskId", id, "error", err)
		respondError(w, http.StatusInternalServerError, "更新任务失败")
		return
	}

	result, _ := h.fetchTask(r.Context(), id)
	respondJSON(w, http.StatusOK, result)
}

func (h *ScenarioTaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	task, err := h.fetchTask(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "任务不存在")
		return
	}
	if task.TenantID == nil {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if !verifyTenantOwnership(w, r, *task.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM scenario_tasks WHERE id = $1 AND tenant_id = $2`, id, task.TenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除任务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *ScenarioTaskHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req ReorderScenarioTasksRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.ScenarioID == "" {
		respondError(w, http.StatusBadRequest, "缺少场景ID")
		return
	}

	var scenarioTenantID *string
	err := h.DB.QueryRow(r.Context(), `SELECT tenant_id FROM scenarios WHERE id = $1`, req.ScenarioID).Scan(&scenarioTenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "场景不存在")
		return
	}
	if scenarioTenantID != nil && !verifyTenantOwnership(w, r, *scenarioTenantID) {
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	for i, taskID := range req.TaskIDs {
		_, err := tx.Exec(r.Context(), `
			UPDATE scenario_tasks SET sort_order = $1 WHERE id = $2 AND scenario_id = $3
		`, i, taskID, req.ScenarioID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "重新排序任务失败")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ScenarioTaskHandler) fetchTask(ctx context.Context, id string) (*domain.ScenarioTask, error) {
	var t domain.ScenarioTask
	err := h.DB.QueryRow(ctx, `SELECT `+taskSelectColumns+` FROM scenario_tasks WHERE id = $1`, id).Scan(
		&t.ID, &t.ScenarioID, &t.Name, &t.Code, &t.SortOrder, &t.Description, &t.DetailedDescription, &t.DescriptionPdf,
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
		&t.ID, &t.ScenarioID, &t.Name, &t.Code, &t.SortOrder, &t.Description, &t.DetailedDescription, &t.DescriptionPdf,
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
			&t.ID, &t.ScenarioID, &t.Name, &t.Code, &t.SortOrder, &t.Description, &t.DetailedDescription, &t.DescriptionPdf,
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

func (h *ScenarioTaskHandler) populateEvalData(ctx context.Context, items []domain.ScenarioTask) {
	if len(items) == 0 {
		return
	}
	taskIDs := make([]string, len(items))
	for i, it := range items {
		taskIDs[i] = it.ID
	}

	rows, err := h.DB.Query(ctx, `
		SELECT task_id, method_key, weight
		FROM task_evaluation_methods
		WHERE task_id = ANY($1) AND is_enabled = true
		ORDER BY method_key
	`, taskIDs)
	if err != nil {
		return
	}
	defer rows.Close()

	type methodSummary struct {
		methods []string
		weights map[string]float64
	}
	methodsByTask := make(map[string]*methodSummary)
	for rows.Next() {
		var taskID, methodKey string
		var weight float64
		if err := rows.Scan(&taskID, &methodKey, &weight); err != nil {
			continue
		}
		ms, ok := methodsByTask[taskID]
		if !ok {
			ms = &methodSummary{weights: make(map[string]float64)}
			methodsByTask[taskID] = ms
		}
		ms.methods = append(ms.methods, methodKey)
		ms.weights[methodKey] = weight
	}

	for i := range items {
		ms, ok := methodsByTask[items[i].ID]
		if !ok {
			continue
		}
		if items[i].EvalData == nil {
			items[i].EvalData = make(domain.JSONMap)
		}
		items[i].EvalData["evaluationMethods"] = ms.methods
		items[i].EvalData["methodWeights"] = ms.weights
	}
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
