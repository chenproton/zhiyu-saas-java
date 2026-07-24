package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type TaskEvaluationHandler struct {
	DB *pgxpool.Pool
}

// Task evaluation methods (replaces old per-config CRUD)

type TaskEvaluationMethodListResponse struct {
	Methods []domain.TaskEvaluationMethod `json:"methods"`
}

type SaveTaskEvaluationMethodsRequest struct {
	Methods []TaskEvaluationMethodInput `json:"methods"`
}

type TaskEvaluationMethodInput struct {
	MethodKey        string          `json:"methodKey"`
	Weight           float64         `json:"weight"`
	EvalObject       string          `json:"evalObject"`
	ScoreType        *string         `json:"scoreType,omitempty"`
	EvalSubjects     json.RawMessage `json:"evalSubjects"`
	RubricTemplateID *string         `json:"rubricTemplateId,omitempty"`
	ResourceConfig   json.RawMessage `json:"resourceConfig,omitempty"`
	EvalPoints       []EvalPointInput `json:"evalPoints,omitempty"`
	ReviewSteps      []ReviewStepInput `json:"reviewSteps,omitempty"`
}

type EvalPointInput struct {
	Name              string          `json:"name"`
	Description       *string         `json:"description,omitempty"`
	SubType           *string         `json:"subType,omitempty"`
	Types             []string        `json:"types,omitempty"`
	Weight            float64         `json:"weight"`
	ScoringMethod     string          `json:"scoringMethod"`
	GradeMapping      json.RawMessage `json:"gradeMapping,omitempty"`
	KnowledgePointIDs []string        `json:"knowledgePointIds,omitempty"`
	AbilityPointIDs   []string        `json:"abilityPointIds,omitempty"`
	SortOrder         int             `json:"sortOrder"`
}

type ReviewStepInput struct {
	Label       string  `json:"label"`
	Description *string `json:"description,omitempty"`
	Enabled     bool    `json:"enabled"`
	SubjectType *string `json:"subjectType,omitempty"`
	Weight      float64 `json:"weight"`
	SortOrder   int     `json:"sortOrder"`
}

func (h *TaskEvaluationHandler) ListMethods(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	taskID := chi.URLParam(r, "taskId")
	if taskID == "" {
		respondError(w, http.StatusBadRequest, "missing taskId")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	configs, err := h.fetchTaskMethods(r.Context(), taskID, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list evaluation methods")
		return
	}

	respondJSON(w, http.StatusOK, TaskEvaluationMethodListResponse{Methods: configs})
}

func (h *TaskEvaluationHandler) SaveMethods(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	taskID := chi.URLParam(r, "taskId")
	if taskID == "" {
		respondError(w, http.StatusBadRequest, "missing taskId")
		return
	}

	var req SaveTaskEvaluationMethodsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `DELETE FROM task_evaluation_methods WHERE task_id = $1 AND tenant_id = $2`, taskID, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clear existing methods")
		return
	}

	for _, m := range req.Methods {
		evalSubjects := jsonRawMessageToJSONSlice(m.EvalSubjects)
		resourceConfig := jsonRawMessageToJSONMap(m.ResourceConfig)

		var configID string
		err := tx.QueryRow(r.Context(), `
			INSERT INTO task_evaluation_methods (tenant_id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id
		`, tenantID, taskID, m.MethodKey, m.Weight, m.EvalObject, m.ScoreType, evalSubjects, m.RubricTemplateID, resourceConfig).Scan(&configID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to insert evaluation method")
			return
		}

		for _, ep := range m.EvalPoints {
			gradeMapping := jsonRawMessageToJSONSlice(ep.GradeMapping)
			_, err := tx.Exec(r.Context(), `
				INSERT INTO task_eval_points (tenant_id, config_id, name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			`, tenantID, configID, ep.Name, ep.Description, ep.SubType, coalesceStringSlice(ep.Types),
				ep.Weight, ep.ScoringMethod, gradeMapping,
				coalesceStringSlice(ep.KnowledgePointIDs), coalesceStringSlice(ep.AbilityPointIDs), ep.SortOrder)
			if err != nil {
				respondError(w, http.StatusInternalServerError, "failed to insert eval point")
				return
			}
		}

		for _, rs := range m.ReviewSteps {
			_, err := tx.Exec(r.Context(), `
				INSERT INTO task_review_steps (tenant_id, config_id, label, description, enabled, subject_type, weight, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, tenantID, configID, rs.Label, rs.Description, rs.Enabled, rs.SubjectType, rs.Weight, rs.SortOrder)
			if err != nil {
				respondError(w, http.StatusInternalServerError, "failed to insert review step")
				return
			}
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	configs, _ := h.fetchTaskMethods(r.Context(), taskID, tenantID)
	respondJSON(w, http.StatusOK, TaskEvaluationMethodListResponse{Methods: configs})
}

// Rubric template CRUD

type RubricTemplateListResponse struct {
	Items []domain.RubricTemplate `json:"items"`
	Total int                      `json:"total"`
}

type RubricTemplateInput struct {
	Name        string         `json:"name"`
	Mode        string         `json:"mode"`
	Types       []string       `json:"types,omitempty"`
	Description *string        `json:"description,omitempty"`
	Data        domain.JSONMap `json:"data"`
}

func (h *TaskEvaluationHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	keyword := r.URL.Query().Get("keyword")

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
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	where = append(where, "tenant_id = $"+itoa(argIdx))
	args = append(args, tenantID)
	argIdx++

	if keyword != "" {
		where = append(where, "name ILIKE $"+itoa(argIdx))
		args = append(args, "%"+keyword+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM rubric_templates WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, name, mode, types, description, data, created_at, updated_at
		FROM rubric_templates
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY updated_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list rubric templates")
		return
	}
	defer rows.Close()

	items, err := scanRubricTemplates(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan rubric templates")
		return
	}

	respondJSON(w, http.StatusOK, RubricTemplateListResponse{Items: items, Total: total})
}

func (h *TaskEvaluationHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	t, err := h.fetchRubricTemplate(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "rubric template not found")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if t.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "access denied")
		return
	}

	respondJSON(w, http.StatusOK, t)
}

func (h *TaskEvaluationHandler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req RubricTemplateInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Mode == "" || req.Data == nil {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	types := coalesceStringSlice(req.Types)
	now := time.Now()
	var id string
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO rubric_templates (tenant_id, name, mode, types, description, data, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, tenantID, req.Name, req.Mode, types, req.Description, req.Data, now, now).Scan(&id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create rubric template")
		return
	}

	t, _ := h.fetchRubricTemplate(r.Context(), id)
	respondJSON(w, http.StatusCreated, t)
}

func (h *TaskEvaluationHandler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")

	var req RubricTemplateInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Mode == "" || req.Data == nil {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	existing, err := h.fetchRubricTemplate(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "rubric template not found")
		return
	}
	if existing.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "access denied")
		return
	}

	types := coalesceStringSlice(req.Types)
	now := time.Now()
	_, err = h.DB.Exec(r.Context(), `
		UPDATE rubric_templates SET name = $1, mode = $2, types = $3, description = $4, data = $5, updated_at = $6
		WHERE id = $7
	`, req.Name, req.Mode, types, req.Description, req.Data, now, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update rubric template")
		return
	}

	t, _ := h.fetchRubricTemplate(r.Context(), id)
	respondJSON(w, http.StatusOK, t)
}

func (h *TaskEvaluationHandler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	existing, err := h.fetchRubricTemplate(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "rubric template not found")
		return
	}
	if existing.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "access denied")
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM rubric_templates WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete rubric template")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *TaskEvaluationHandler) fetchTaskMethods(ctx context.Context, taskID, tenantID string) ([]domain.TaskEvaluationMethod, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config
		FROM task_evaluation_methods
		WHERE task_id = $1 AND tenant_id = $2
		ORDER BY method_key
	`, taskID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var methods []domain.TaskEvaluationMethod
	configIDs := make([]string, 0)
	for rows.Next() {
		var m domain.TaskEvaluationMethod
		if err := rows.Scan(&m.ID, &m.TaskID, &m.MethodKey, &m.Weight, &m.EvalObject, &m.ScoreType, &m.EvalSubjects, &m.RubricTemplateID, &m.ResourceConfig); err != nil {
			return nil, err
		}
		methods = append(methods, m)
		configIDs = append(configIDs, m.ID)
	}

	if len(configIDs) == 0 {
		return methods, nil
	}

	evalPointsByConfig := make(map[string][]domain.TaskEvalPoint)
	reviewStepsByConfig := make(map[string][]domain.TaskReviewStep)

	epRows, err := h.DB.Query(ctx, `
		SELECT id, config_id, name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order
		FROM task_eval_points
		WHERE config_id = ANY($1)
		ORDER BY sort_order
	`, configIDs)
	if err != nil {
		return methods, nil
	}
	defer epRows.Close()
	for epRows.Next() {
		var p domain.TaskEvalPoint
		if err := epRows.Scan(&p.ID, &p.ConfigID, &p.Name, &p.Description, &p.SubType, &p.Types, &p.Weight, &p.ScoringMethod, &p.GradeMapping, &p.KnowledgePointIDs, &p.AbilityPointIDs, &p.SortOrder); err != nil {
			continue
		}
		evalPointsByConfig[p.ConfigID] = append(evalPointsByConfig[p.ConfigID], p)
	}

	rsRows, err := h.DB.Query(ctx, `
		SELECT id, config_id, label, description, enabled, subject_type, weight, sort_order
		FROM task_review_steps
		WHERE config_id = ANY($1)
		ORDER BY sort_order
	`, configIDs)
	if err != nil {
		return methods, nil
	}
	defer rsRows.Close()
	for rsRows.Next() {
		var s domain.TaskReviewStep
		if err := rsRows.Scan(&s.ID, &s.ConfigID, &s.Label, &s.Description, &s.Enabled, &s.SubjectType, &s.Weight, &s.SortOrder); err != nil {
			continue
		}
		reviewStepsByConfig[s.ConfigID] = append(reviewStepsByConfig[s.ConfigID], s)
	}

	for i := range methods {
		methods[i].EvalPoints = evalPointsByConfig[methods[i].ID]
		methods[i].ReviewSteps = reviewStepsByConfig[methods[i].ID]
	}

	return methods, nil
}

func (h *TaskEvaluationHandler) fetchRubricTemplate(ctx context.Context, id string) (*domain.RubricTemplate, error) {
	var t domain.RubricTemplate
	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, mode, types, description, data, created_at, updated_at
		FROM rubric_templates WHERE id = $1
	`, id).Scan(&t.ID, &t.TenantID, &t.Name, &t.Mode, &t.Types, &t.Description, &t.Data, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func scanRubricTemplates(rows pgx.Rows) ([]domain.RubricTemplate, error) {
	items := make([]domain.RubricTemplate, 0)
	for rows.Next() {
		var t domain.RubricTemplate
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Name, &t.Mode, &t.Types, &t.Description, &t.Data, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, nil
}

func jsonRawMessageToJSONSlice(raw json.RawMessage) domain.JSONSlice {
	if len(raw) == 0 || string(raw) == "null" {
		return domain.JSONSlice{}
	}
	var s domain.JSONSlice
	_ = json.Unmarshal(raw, &s)
	if s == nil {
		return domain.JSONSlice{}
	}
	return s
}

func jsonRawMessageToJSONMap(raw json.RawMessage) domain.JSONMap {
	if len(raw) == 0 || string(raw) == "null" {
		return domain.JSONMap{}
	}
	var m domain.JSONMap
	_ = json.Unmarshal(raw, &m)
	if m == nil {
		return domain.JSONMap{}
	}
	return m
}
