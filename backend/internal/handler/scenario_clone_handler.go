package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

func NewScenarioCloneHandler(pool *pgxpool.Pool) *ScenarioCloneHandler {
	return &ScenarioCloneHandler{DB: pool}
}

type ScenarioCloneHandler struct {
	DB *pgxpool.Pool
}

type CloneScenarioRequest struct {
	Name string `json:"name"`
	Code string `json:"code"`
}

func (h *ScenarioCloneHandler) Clone(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	src, err := h.fetchSourceScenario(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "scenario not found")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if src.TenantID != nil && *src.TenantID != tenantID {
		respondError(w, http.StatusForbidden, "access denied")
		return
	}

	var req CloneScenarioRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	newName := req.Name
	if newName == "" {
		newName = src.Name + " (克隆)"
	}
	newCode := req.Code
	if newCode == "" {
		newCode = src.Code + "-clone"
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	newID := uuid.NewString()
	_, err = tx.Exec(r.Context(), `
		INSERT INTO scenarios (id, name, code, cover_image, career_position_id, industry_ids,
			profession_ids, batch_id, difficulty, version, status, background,
			delivery_goal, creator_id, co_builder_ids, tenant_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11, $12, $13, $14, $15)
	`, newID, newName, newCode, src.CoverImage, src.CareerPositionID, src.IndustryIDs,
		src.ProfessionIDs, src.BatchID, src.Difficulty, src.Version, src.Background,
		src.DeliveryGoal, claims.UserID, coalesceStringSlice(src.CoBuilderIDs), tenantID)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "场景方案代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to clone scenario")
		return
	}

	taskIDMap := make(map[string]string)
	var taskIDs []string

	taskRows, err := tx.Query(r.Context(), `
		SELECT id, scenario_id, name, code, sort_order, description, detailed_description, description_pdf,
			estimated_hours, task_type, difficulty, background, dependency_ids,
			knowledge_point_ids, ability_point_ids, resource_ids, eval_data
		FROM scenario_tasks WHERE scenario_id = $1 ORDER BY sort_order
	`, id)
	if err == nil {
		for taskRows.Next() {
			var oldID, oldScenarioID string
			var name, code string
			var sortOrder int
			var description, detailedDescription, descriptionPdf *string
			var estimatedHours float64
			var taskType string
			var difficulty int
			var background *string
			var dependencyIDs, knowledgePointIDs, abilityPointIDs, resourceIDs []string
			var evalData []byte
			if err := taskRows.Scan(&oldID, &oldScenarioID, &name, &code, &sortOrder,
				&description, &detailedDescription, &descriptionPdf,
				&estimatedHours, &taskType, &difficulty, &background,
				&dependencyIDs, &knowledgePointIDs, &abilityPointIDs, &resourceIDs, &evalData); err != nil {
				continue
			}

			newTaskID := uuid.NewString()
			taskIDMap[oldID] = newTaskID
			taskIDs = append(taskIDs, newTaskID)

			_, err := tx.Exec(r.Context(), `INSERT INTO scenario_tasks (`+taskInsertColumns+`)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
			`, newTaskID, newID, name, code, sortOrder, description, detailedDescription, descriptionPdf,
				estimatedHours, taskType, difficulty, background,
				dependencyIDs, false, nil, // is_referenced=false, source_scenario_id=nil
				knowledgePointIDs, abilityPointIDs, resourceIDs, evalData, tenantID)
			if err != nil {
				respondError(w, http.StatusInternalServerError, "failed to clone task")
				return
			}

			if err := h.cloneTaskDeliverables(tx, oldID, newTaskID, tenantID); err != nil {
				respondError(w, http.StatusInternalServerError, "failed to clone deliverables")
				return
			}
			if err := h.cloneTaskEvaluationMethods(tx, oldID, newTaskID, tenantID); err != nil {
				respondError(w, http.StatusInternalServerError, "failed to clone evaluation methods")
				return
			}
			if err := h.cloneTaskResourceBindings(tx, oldID, newTaskID, tenantID); err != nil {
				respondError(w, http.StatusInternalServerError, "failed to clone resource bindings")
				return
			}
			if err := h.cloneTaskKnowledgeBindings(tx, oldID, newTaskID, tenantID); err != nil {
				respondError(w, http.StatusInternalServerError, "failed to clone knowledge bindings")
				return
			}
			if err := h.cloneTaskAbilityBindings(tx, oldID, newTaskID, tenantID); err != nil {
				respondError(w, http.StatusInternalServerError, "failed to clone ability bindings")
				return
			}
		}
		taskRows.Close()
	}

	for _, newTaskID := range taskIDs {
		if err := h.remapTaskDependencyIDs(tx, newTaskID, taskIDMap); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to remap task dependencies")
			return
		}
	}

	if err := h.cloneScenarioWeights(tx, id, newID, taskIDMap, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clone weights")
		return
	}
	if err := h.cloneScenarioGradeMappings(tx, id, newID, taskIDMap, tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to clone grade mappings")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	handler := &ScenarioHandler{DB: h.DB}
	scenario, _ := handler.fetchScenario(r.Context(), newID)
	respondJSON(w, http.StatusCreated, scenario)
}

type sourceScenarioFields struct {
	Name            string
	Code            string
	CoverImage      *string
	CareerPositionID *string
	IndustryIDs     []string
	ProfessionIDs   []string
	BatchID         *string
	Difficulty      int
	Version         string
	Background      *string
	DeliveryGoal    *string
	CoBuilderIDs    []string
	TenantID        *string
}

func (h *ScenarioCloneHandler) fetchSourceScenario(ctx context.Context, id string) (*sourceScenarioFields, error) {
	var s sourceScenarioFields
	err := h.DB.QueryRow(ctx, `
		SELECT name, code, cover_image, career_position_id, industry_ids,
			profession_ids, batch_id, difficulty, version, background,
			delivery_goal, co_builder_ids, tenant_id
		FROM scenarios WHERE id = $1
	`, id).Scan(&s.Name, &s.Code, &s.CoverImage, &s.CareerPositionID,
		&s.IndustryIDs, &s.ProfessionIDs, &s.BatchID, &s.Difficulty,
		&s.Version, &s.Background, &s.DeliveryGoal, &s.CoBuilderIDs, &s.TenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (h *ScenarioCloneHandler) cloneTaskDeliverables(tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(context.Background(), `
		SELECT type, name, description, evaluation_points, sort_order
		FROM task_deliverables WHERE task_id = $1 ORDER BY sort_order
	`, oldTaskID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var typ, name string
		var description *string
		var evalPoints []byte
		var sortOrder int
		if err := rows.Scan(&typ, &name, &description, &evalPoints, &sortOrder); err != nil {
			continue
		}
		_, err := tx.Exec(context.Background(), `
			INSERT INTO task_deliverables (id, task_id, type, name, description, evaluation_points, sort_order, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, uuid.NewString(), newTaskID, typ, name, description, evalPoints, sortOrder, tenantID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskEvaluationMethods(tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(context.Background(), `
		SELECT id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config
		FROM task_evaluation_methods WHERE task_id = $1 AND tenant_id = $2
	`, oldTaskID, tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var oldConfigID, methodKey string
		var weight float64
		var evalObject string
		var scoreType *string
		var evalSubjects []byte
		var rubricTemplateID *string
		var resourceConfig []byte
		if err := rows.Scan(&oldConfigID, &methodKey, &weight, &evalObject, &scoreType, &evalSubjects, &rubricTemplateID, &resourceConfig); err != nil {
			continue
		}

		newConfigID := uuid.NewString()
		_, err := tx.Exec(context.Background(), `
			INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, newConfigID, tenantID, newTaskID, methodKey, weight, evalObject, scoreType, evalSubjects, rubricTemplateID, resourceConfig)
		if err != nil {
			return err
		}

		if err := h.cloneTaskEvalPoints(tx, oldConfigID, newConfigID, tenantID); err != nil {
			return err
		}
		if err := h.cloneTaskReviewSteps(tx, oldConfigID, newConfigID, tenantID); err != nil {
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskEvalPoints(tx pgx.Tx, oldConfigID, newConfigID, tenantID string) error {
	rows, err := tx.Query(context.Background(), `
		SELECT name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order
		FROM task_eval_points WHERE config_id = $1
	`, oldConfigID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		var description *string
		var subType *string
		var types []string
		var weight float64
		var scoringMethod string
		var gradeMapping []byte
		var knowledgePointIDs, abilityPointIDs []string
		var sortOrder int
		if err := rows.Scan(&name, &description, &subType, &types, &weight, &scoringMethod, &gradeMapping, &knowledgePointIDs, &abilityPointIDs, &sortOrder); err != nil {
			continue
		}
		_, err := tx.Exec(context.Background(), `
			INSERT INTO task_eval_points (id, tenant_id, config_id, name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		`, uuid.NewString(), tenantID, newConfigID, name, description, subType, types, weight, scoringMethod, gradeMapping, knowledgePointIDs, abilityPointIDs, sortOrder)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskReviewSteps(tx pgx.Tx, oldConfigID, newConfigID, tenantID string) error {
	rows, err := tx.Query(context.Background(), `
		SELECT label, description, enabled, subject_type, weight, sort_order
		FROM task_review_steps WHERE config_id = $1
	`, oldConfigID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var label string
		var description *string
		var enabled bool
		var subjectType *string
		var weight float64
		var sortOrder int
		if err := rows.Scan(&label, &description, &enabled, &subjectType, &weight, &sortOrder); err != nil {
			continue
		}
		_, err := tx.Exec(context.Background(), `
			INSERT INTO task_review_steps (id, tenant_id, config_id, label, description, enabled, subject_type, weight, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, uuid.NewString(), tenantID, newConfigID, label, description, enabled, subjectType, weight, sortOrder)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskResourceBindings(tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(context.Background(), `
		SELECT resource_id FROM task_resource_bindings WHERE task_id = $1
	`, oldTaskID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var resourceID string
		if err := rows.Scan(&resourceID); err != nil {
			continue
		}
		_, err := tx.Exec(context.Background(), `
			INSERT INTO task_resource_bindings (id, task_id, resource_id, tenant_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), newTaskID, resourceID, tenantID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskKnowledgeBindings(tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(context.Background(), `
		SELECT knowledge_point_id FROM task_knowledge_bindings WHERE task_id = $1
	`, oldTaskID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var kpID string
		if err := rows.Scan(&kpID); err != nil {
			continue
		}
		_, err := tx.Exec(context.Background(), `
			INSERT INTO task_knowledge_bindings (id, task_id, knowledge_point_id, tenant_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), newTaskID, kpID, tenantID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskAbilityBindings(tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(context.Background(), `
		SELECT ability_point_id FROM task_ability_bindings WHERE task_id = $1
	`, oldTaskID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var apID string
		if err := rows.Scan(&apID); err != nil {
			continue
		}
		_, err := tx.Exec(context.Background(), `
			INSERT INTO task_ability_bindings (id, task_id, ability_point_id, tenant_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), newTaskID, apID, tenantID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) remapTaskDependencyIDs(tx pgx.Tx, taskID string, idMap map[string]string) error {
	var oldDeps []string
	err := tx.QueryRow(context.Background(), `
		SELECT dependency_ids FROM scenario_tasks WHERE id = $1
	`, taskID).Scan(&oldDeps)
	if err != nil || len(oldDeps) == 0 {
		return nil
	}

	newDeps := make([]string, 0, len(oldDeps))
	for _, old := range oldDeps {
		if newID, ok := idMap[old]; ok {
			newDeps = append(newDeps, newID)
		}
	}

	_, err = tx.Exec(context.Background(), `
		UPDATE scenario_tasks SET dependency_ids = $1 WHERE id = $2
	`, coalesceStringSlice(newDeps), taskID)
	return err
}

func (h *ScenarioCloneHandler) cloneScenarioWeights(tx pgx.Tx, oldScenarioID, newScenarioID string, taskIDMap map[string]string, tenantID string) error {
	rows, err := tx.Query(context.Background(), `
		SELECT task_id, weight FROM scenario_weight_configs WHERE scenario_id = $1
	`, oldScenarioID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var oldTaskID string
		var weight float64
		if err := rows.Scan(&oldTaskID, &weight); err != nil {
			continue
		}
		newTaskID, ok := taskIDMap[oldTaskID]
		if !ok {
			continue
		}
		_, err := tx.Exec(context.Background(), `
			INSERT INTO scenario_weight_configs (id, scenario_id, task_id, weight, tenant_id)
			VALUES ($1, $2, $3, $4, $5)
		`, uuid.NewString(), newScenarioID, newTaskID, weight, tenantID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneScenarioGradeMappings(tx pgx.Tx, oldScenarioID, newScenarioID string, taskIDMap map[string]string, tenantID string) error {
	rows, err := tx.Query(context.Background(), `
		SELECT task_id, level, min_score, max_score, description, color
		FROM scenario_grade_mappings WHERE scenario_id = $1
	`, oldScenarioID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	for rows.Next() {
		var oldTaskID *string
		var level string
		var minScore, maxScore float64
		var description *string
		var color *string
		if err := rows.Scan(&oldTaskID, &level, &minScore, &maxScore, &description, &color); err != nil {
			continue
		}

		var newTaskID *string
		if oldTaskID != nil {
			if mapped, ok := taskIDMap[*oldTaskID]; ok {
				newTaskID = &mapped
			} else {
				continue
			}
		}

		_, err := tx.Exec(context.Background(), `
			INSERT INTO scenario_grade_mappings (id, scenario_id, task_id, level, min_score, max_score, description, color, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, uuid.NewString(), newScenarioID, newTaskID, level, minScore, maxScore, description, color, tenantID)
		if err != nil {
			return err
		}
	}
	return nil
}
