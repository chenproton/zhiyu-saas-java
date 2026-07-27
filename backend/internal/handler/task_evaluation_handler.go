package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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
	Version int                         `json:"version"`
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
	Version          int             `json:"version"`
	IsEnabled        bool            `json:"isEnabled"`
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

	// Optimistic locking: when client provides a version, ensure no newer version exists.
	if req.Version > 0 {
		var currentVersion int
		err := h.DB.QueryRow(r.Context(), `
			SELECT COALESCE(MAX(version), 0) FROM task_evaluation_methods WHERE task_id = $1 AND tenant_id = $2
		`, taskID, tenantID).Scan(&currentVersion)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to check evaluation method version")
			return
		}
		if currentVersion > req.Version {
			respondError(w, http.StatusConflict, "evaluation rules have been modified by another session")
			return
		}
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	// Soft-delete all methods for this task first. Incoming methods will be re-enabled.
	_, err = tx.Exec(r.Context(), `
		UPDATE task_evaluation_methods SET is_enabled = false
		WHERE task_id = $1 AND tenant_id = $2
	`, taskID, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to disable existing methods")
		return
	}

	// Fetch task name for auto-generated temp exams.
	var taskName string
	_ = tx.QueryRow(r.Context(), `SELECT name FROM scenario_tasks WHERE id = $1`, taskID).Scan(&taskName)
	if taskName == "" {
		taskName = "未命名任务"
	}
	claims := middleware.CurrentUser(r)
	creatorID := ""
	if claims != nil {
		creatorID = claims.UserID
	}

	newVersion := req.Version + 1
	for _, m := range req.Methods {
		evalSubjects := jsonRawMessageToJSONSlice(m.EvalSubjects)
		resourceConfig := jsonRawMessageToJSONMap(m.ResourceConfig)

		// Ensure exam usage for paper / question_bank / quiz methods.
		if m.IsEnabled && (m.MethodKey == "paper" || m.MethodKey == "question_bank" || m.MethodKey == "quiz") {
			updatedConfig, err := h.ensureExamUsageForMethod(r.Context(), tx, tenantID, taskID, taskName, creatorID, m.MethodKey, resourceConfig)
			if err != nil {
				// Log but don't fail the whole save; student side will show "not configured".
				log.Printf("failed to ensure exam usage for task %s method %s: %v", taskID, m.MethodKey, err)
			} else {
				resourceConfig = updatedConfig
			}
		}

		var configID string
		err := tx.QueryRow(r.Context(), `
			INSERT INTO task_evaluation_methods (tenant_id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config, version, is_enabled)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (task_id, method_key) DO UPDATE SET
				weight = EXCLUDED.weight,
				eval_object = EXCLUDED.eval_object,
				score_type = EXCLUDED.score_type,
				eval_subjects = EXCLUDED.eval_subjects,
				rubric_template_id = EXCLUDED.rubric_template_id,
				resource_config = EXCLUDED.resource_config,
				version = EXCLUDED.version,
				is_enabled = EXCLUDED.is_enabled
			RETURNING id
		`, tenantID, taskID, m.MethodKey, m.Weight, m.EvalObject, m.ScoreType, evalSubjects, m.RubricTemplateID, resourceConfig, newVersion, m.IsEnabled).Scan(&configID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to upsert evaluation method")
			return
		}

		// Only rewrite eval points / review steps for enabled methods.
		// Disabled methods keep their existing children so they can be restored later.
		if m.IsEnabled {
			_, err = tx.Exec(r.Context(), `DELETE FROM task_eval_points WHERE config_id = $1`, configID)
			if err != nil {
				respondError(w, http.StatusInternalServerError, "failed to clear eval points")
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

			_, err = tx.Exec(r.Context(), `DELETE FROM task_review_steps WHERE config_id = $1`, configID)
			if err != nil {
				respondError(w, http.StatusInternalServerError, "failed to clear review steps")
				return
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

	where = append(where, "is_deleted = false")

	countQuery := "SELECT COUNT(*) FROM rubric_templates WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, name, mode, types, description, data, is_deleted, created_at, updated_at
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

	_, err = h.DB.Exec(r.Context(), `
		UPDATE rubric_templates SET is_deleted = true, updated_at = NOW()
		WHERE id = $1
	`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete rubric template")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *TaskEvaluationHandler) fetchTaskMethods(ctx context.Context, taskID, tenantID string) ([]domain.TaskEvaluationMethod, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config, version, is_enabled
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
		if err := rows.Scan(&m.ID, &m.TaskID, &m.MethodKey, &m.Weight, &m.EvalObject, &m.ScoreType, &m.EvalSubjects, &m.RubricTemplateID, &m.ResourceConfig, &m.Version, &m.IsEnabled); err != nil {
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
		SELECT id, tenant_id, name, mode, types, description, data, is_deleted, created_at, updated_at
		FROM rubric_templates WHERE id = $1
	`, id).Scan(&t.ID, &t.TenantID, &t.Name, &t.Mode, &t.Types, &t.Description, &t.Data, &t.IsDeleted, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func scanRubricTemplates(rows pgx.Rows) ([]domain.RubricTemplate, error) {
	items := make([]domain.RubricTemplate, 0)
	for rows.Next() {
		var t domain.RubricTemplate
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Name, &t.Mode, &t.Types, &t.Description, &t.Data, &t.IsDeleted, &t.CreatedAt, &t.UpdatedAt); err != nil {
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

// ensureExamUsageForMethod ensures an exam and usage exist for paper / question_bank / quiz methods.
func (h *TaskEvaluationHandler) ensureExamUsageForMethod(
	ctx context.Context,
	tx pgx.Tx,
	tenantID, taskID, taskName, creatorID, methodKey string,
	resourceConfig domain.JSONMap,
) (domain.JSONMap, error) {
	methodLabels := map[string]string{
		"paper":         "试卷",
		"question_bank": "题库",
		"quiz":          "随堂测",
	}
	label := methodLabels[methodKey]
	if label == "" {
		label = methodKey
	}

	examID, _ := resourceConfig["examId"].(string)
	if methodKey == "paper" {
		if pid, ok := resourceConfig["paperId"].(string); ok && pid != "" {
			examID = pid
		}
	}
	usageID, _ := resourceConfig["usageId"].(string)

	// For question_bank / quiz, auto-create a temp exam from questionIds.
	if methodKey == "question_bank" || methodKey == "quiz" {
		questionIDs := getStringSliceFromJSONMap(resourceConfig, "questionIds")
		if len(questionIDs) == 0 {
			return resourceConfig, nil
		}

		if examID == "" {
			duration := 90
			if d, ok := resourceConfig["duration"].(float64); ok && d > 0 {
				duration = int(d)
			} else if d, ok := resourceConfig["timeLimit"].(float64); ok && d > 0 {
				duration = int(d)
			}
			name := fmt.Sprintf("%s-%s", taskName, label)
			id, err := h.createTempExam(ctx, tx, tenantID, name, duration, creatorID)
			if err != nil {
				return resourceConfig, err
			}
			examID = id
			resourceConfig["examId"] = examID
		}

		if err := h.ensureExamQuestions(ctx, tx, tenantID, examID, questionIDs); err != nil {
			return resourceConfig, err
		}
	}

	if examID == "" {
		return resourceConfig, nil
	}

	if usageID == "" {
		id, err := h.createTempExamUsage(ctx, tx, tenantID, examID, taskID, creatorID)
		if err != nil {
			return resourceConfig, err
		}
		usageID = id
		resourceConfig["usageId"] = usageID
	}

	return resourceConfig, nil
}

func (h *TaskEvaluationHandler) createTempExam(ctx context.Context, tx pgx.Tx, tenantID, name string, duration int, creatorID string) (string, error) {
	id := uuid.NewString()
	code, err := generateUniqueEntityCode(ctx, tx, "SJ", "exams", tenantID)
	if err != nil {
		return "", fmt.Errorf("generate exam code: %w", err)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration, cover_image,
			collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, creator_id, is_temp)
		VALUES ($1, $2, $3, $4, '', 'draft', 0, $5, NULL, '{}', '{}', NULL, 'v1.0', 'mine', $6, TRUE)
	`, id, tenantID, code, name, duration, creatorID)
	if err != nil {
		return "", fmt.Errorf("create temp exam: %w", err)
	}
	return id, nil
}

func (h *TaskEvaluationHandler) ensureExamQuestions(ctx context.Context, tx pgx.Tx, tenantID, examID string, questionIDs []string) error {
	// Fetch questions from the question pool.
	rows, err := tx.Query(ctx, `
		SELECT id, type, content, options, answer, analysis, score
		FROM questions
		WHERE id = ANY($1) AND tenant_id = $2
		ORDER BY array_position($1, id)
	`, questionIDs, tenantID)
	if err != nil {
		return fmt.Errorf("fetch questions: %w", err)
	}
	defer rows.Close()

	type q struct {
		id      string
		qType   string
		content string
		options []byte
		answer  []byte
		analysis *string
		score   float64
	}
	var questions []q
	for rows.Next() {
		var qq q
		var optionsStr, answerStr *string
		if err := rows.Scan(&qq.id, &qq.qType, &qq.content, &optionsStr, &answerStr, &qq.analysis, &qq.score); err != nil {
			continue
		}
		if optionsStr != nil {
			qq.options = []byte(*optionsStr)
		} else {
			qq.options = []byte("[]")
		}
		if answerStr != nil {
			qq.answer = []byte(*answerStr)
		} else {
			qq.answer = []byte("[]")
		}
		questions = append(questions, qq)
	}

	for i, qq := range questions {
		var existingID string
		_ = tx.QueryRow(ctx, `SELECT id FROM exam_questions WHERE exam_id = $1 AND question_id = $2`, examID, qq.id).Scan(&existingID)
		if existingID != "" {
			_, err := tx.Exec(ctx, `
				UPDATE exam_questions SET type = $1, content = $2, options = $3, answer = $4, analysis = $5, score = $6, sort_order = $7
				WHERE id = $8
			`, qq.qType, qq.content, string(qq.options), string(qq.answer), qq.analysis, qq.score, i+1, existingID)
			if err != nil {
				return fmt.Errorf("update exam question %s: %w", qq.id, err)
			}
		} else {
			_, err := tx.Exec(ctx, `
				INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			`, uuid.NewString(), tenantID, examID, qq.id, qq.qType, qq.content, string(qq.options), string(qq.answer), qq.analysis, qq.score, i+1)
			if err != nil {
				return fmt.Errorf("insert exam question %s: %w", qq.id, err)
			}
		}
	}

	// Recalculate total score.
	_, err = tx.Exec(ctx, `
		UPDATE exams SET total_score = COALESCE((SELECT SUM(score) FROM exam_questions WHERE exam_id = $1), 0), updated_at = NOW()
		WHERE id = $1
	`, examID)
	if err != nil {
		return fmt.Errorf("recalc exam total: %w", err)
	}
	return nil
}

func (h *TaskEvaluationHandler) createTempExamUsage(ctx context.Context, tx pgx.Tx, tenantID, examID, taskID, creatorID string) (string, error) {
	id := uuid.NewString()
	var creator interface{}
	if creatorID != "" {
		creator = creatorID
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id)
		VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, 'task', $5, 'draft', $6)
	`, id, tenantID, examID, fmt.Sprintf("场景任务-%s", taskID), []string{taskID}, creator)
	if err != nil {
		return "", fmt.Errorf("create temp exam usage: %w", err)
	}
	return id, nil
}

func getStringSliceFromJSONMap(m domain.JSONMap, key string) []string {
	raw, ok := m[key]
	if !ok || raw == nil {
		return nil
	}
	switch v := raw.(type) {
	case []string:
		return v
	case []interface{}:
		out := make([]string, 0, len(v))
		for _, x := range v {
			if s, ok := x.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}
