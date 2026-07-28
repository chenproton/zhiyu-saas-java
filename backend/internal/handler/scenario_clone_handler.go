package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type ScenarioCloneHandler struct {
	DB *pgxpool.Pool
}

type CloneScenarioRequest struct {
	Name string `json:"name"`
	Code string `json:"code"`
}

func (h *ScenarioCloneHandler) Clone(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			slog.Error("[CloneScenario] panic recovered", "panic", rec, "stack", string(debug.Stack()))
			respondError(w, http.StatusInternalServerError, "服务器内部错误")
		}
	}()

	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	slog.Info("[CloneScenario] start", "scenario_id", id, "user_id", claims.UserID, "tenant_id", claims.TenantID)

	src, err := h.fetchSourceScenario(r.Context(), id)
	if err != nil {
		slog.Error("[CloneScenario] fetch source scenario failed", "scenario_id", id, "error", err)
		respondError(w, http.StatusNotFound, "场景方案不存在")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if src.TenantID != nil && *src.TenantID != tenantID {
		slog.Error("[CloneScenario] tenant mismatch", "scenario_tenant", *src.TenantID, "user_tenant", tenantID)
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CloneScenarioRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	newName := req.Name
	if newName == "" {
		newName = src.Name + " (克隆)"
	}

	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		slog.Error("[CloneScenario] begin transaction failed", "error", err)
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(ctx)

	newCode := req.Code
	if newCode == "" {
		newCode = h.generateUniqueScenarioCode(ctx, tx, tenantID, src.Code)
	}
	slog.Info("[CloneScenario] generated new code", "new_code", newCode)

	newID := uuid.NewString()
	_, err = tx.Exec(ctx, `
		INSERT INTO scenarios (id, name, code, cover_image, career_position_id, industry_ids,
			profession_ids, batch_id, difficulty, version, status, background,
			delivery_goal, creator_id, co_builder_ids, tenant_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11, $12, $13, $14, $15)
	`, newID, newName, newCode, src.CoverImage, src.CareerPositionID, src.IndustryIDs,
		src.ProfessionIDs, src.BatchID, src.Difficulty, src.Version, src.Background,
		src.DeliveryGoal, claims.UserID, coalesceStringSlice(src.CoBuilderIDs), tenantID)
	if err != nil {
		slog.Error("[CloneScenario] insert scenario failed", "scenario_id", newID, "code", newCode, "error", err)
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "场景方案代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "克隆场景方案失败")
		return
	}

	taskIDMap := make(map[string]string)

	type taskRow struct {
		oldID, name, code   string
		sortOrder           int
		description         *string
		detailedDescription *string
		descriptionPdf      *string
		estimatedHours      float64
		taskType            string
		difficulty          int
		background          *string
		dependencyIDs       []string
		knowledgePointIDs   []string
		abilityPointIDs     []string
		resourceIDs         []string
		evalData            []byte
	}

	var taskData []taskRow
	taskRows, err := tx.Query(ctx, `
		SELECT id, name, code, sort_order, description, detailed_description, description_pdf,
			estimated_hours, task_type, difficulty, background, dependency_ids,
			knowledge_point_ids, ability_point_ids, resource_ids, eval_data
		FROM scenario_tasks WHERE scenario_id = $1 ORDER BY sort_order
	`, id)
	if err == nil {
		for taskRows.Next() {
			var tr taskRow
			if err := taskRows.Scan(&tr.oldID, &tr.name, &tr.code, &tr.sortOrder,
				&tr.description, &tr.detailedDescription, &tr.descriptionPdf,
				&tr.estimatedHours, &tr.taskType, &tr.difficulty, &tr.background,
				&tr.dependencyIDs, &tr.knowledgePointIDs, &tr.abilityPointIDs, &tr.resourceIDs, &tr.evalData); err != nil {
				continue
			}
			taskData = append(taskData, tr)
		}
		taskRows.Close()
	}

	for _, tr := range taskData {
		newTaskID := uuid.NewString()
		taskIDMap[tr.oldID] = newTaskID

		_, err := tx.Exec(ctx, `INSERT INTO scenario_tasks (id, `+taskInsertColumns+`)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
		`, newTaskID, newID, tr.name, tr.code, tr.sortOrder, tr.description, tr.detailedDescription, tr.descriptionPdf,
			tr.estimatedHours, tr.taskType, tr.difficulty, tr.background,
			tr.dependencyIDs, false, nil,
			tr.knowledgePointIDs, tr.abilityPointIDs, tr.resourceIDs, tr.evalData, tenantID)
		if err != nil {
			slog.Error("[CloneScenario] insert task failed", "old_task_id", tr.oldID, "new_task_id", newTaskID, "error", err)
			respondError(w, http.StatusInternalServerError, "克隆任务失败")
			return
		}

		if err := h.cloneTaskDeliverables(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			slog.Error("[CloneScenario] clone deliverables failed", "old_task_id", tr.oldID, "new_task_id", newTaskID, "error", err)
			respondError(w, http.StatusInternalServerError, "克隆交付物失败")
			return
		}
		if err := h.cloneTaskEvaluationMethods(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			slog.Error("[CloneScenario] clone evaluation methods failed", "old_task_id", tr.oldID, "new_task_id", newTaskID, "error", err)
			respondError(w, http.StatusInternalServerError, "克隆测评方法失败")
			return
		}
		if err := h.cloneTaskResourceBindings(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			slog.Error("[CloneScenario] clone resource bindings failed", "old_task_id", tr.oldID, "new_task_id", newTaskID, "error", err)
			respondError(w, http.StatusInternalServerError, "克隆资源绑定失败")
			return
		}
		if err := h.cloneTaskKnowledgeBindings(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			slog.Error("[CloneScenario] clone knowledge bindings failed", "old_task_id", tr.oldID, "new_task_id", newTaskID, "error", err)
			respondError(w, http.StatusInternalServerError, "克隆knowledge bindings失败")
			return
		}
		if err := h.cloneTaskAbilityBindings(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			slog.Error("[CloneScenario] clone ability bindings failed", "old_task_id", tr.oldID, "new_task_id", newTaskID, "error", err)
			respondError(w, http.StatusInternalServerError, "克隆能力绑定失败")
			return
		}
	}

	for _, newTaskID := range taskIDMap {
		if err := h.remapTaskDependencyIDs(ctx, tx, newTaskID, taskIDMap); err != nil {
			slog.Error("[CloneScenario] remap dependencies failed", "new_task_id", newTaskID, "error", err)
			respondError(w, http.StatusInternalServerError, "重新映射任务依赖失败")
			return
		}
	}

	if err := h.cloneScenarioWeights(ctx, tx, id, newID, taskIDMap, tenantID); err != nil {
		slog.Error("[CloneScenario] clone weights failed", "error", err)
		respondError(w, http.StatusInternalServerError, "克隆权重失败")
		return
	}
	if err := h.cloneScenarioGradeMappings(ctx, tx, id, newID, taskIDMap, tenantID); err != nil {
		slog.Error("[CloneScenario] clone grade mappings failed", "error", err)
		respondError(w, http.StatusInternalServerError, "克隆成绩映射失败")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("[CloneScenario] commit failed", "error", err)
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	handler := &ScenarioHandler{DB: h.DB}
	scenario, err := handler.fetchScenario(ctx, newID)
	if err != nil {
		slog.Error("[CloneScenario] fetch cloned scenario failed", "new_id", newID, "error", err)
		respondError(w, http.StatusInternalServerError, "获取cloned scenario失败")
		return
	}
	slog.Info("[CloneScenario] success", "new_scenario_id", newID, "code", newCode)
	respondJSON(w, http.StatusCreated, scenario)
}

func (h *ScenarioCloneHandler) generateUniqueScenarioCode(ctx context.Context, tx pgx.Tx, tenantID, srcCode string) string {
	base := srcCode + "-clone"
	var exists bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM scenarios WHERE tenant_id = $1 AND code = $2)`, tenantID, base).Scan(&exists)
	if err != nil {
		slog.Error("[CloneScenario] check code existence failed", "base", base, "error", err)
		return base
	}
	if !exists {
		return base
	}
	for i := 2; i < 1000; i++ {
		candidate := fmt.Sprintf("%s-%d", base, i)
		err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM scenarios WHERE tenant_id = $1 AND code = $2)`, tenantID, candidate).Scan(&exists)
		if err != nil {
			slog.Error("[CloneScenario] check code existence failed", "candidate", candidate, "error", err)
			return candidate
		}
		if !exists {
			return candidate
		}
	}
	return base + "-" + uuid.NewString()[:8]
}

type sourceScenarioFields struct {
	Name             string
	Code             string
	CoverImage       *string
	CareerPositionID *string
	IndustryIDs      []string
	ProfessionIDs    []string
	BatchID          *string
	Difficulty       int
	Version          string
	Background       *string
	DeliveryGoal     *string
	CoBuilderIDs     []string
	TenantID         *string
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

func (h *ScenarioCloneHandler) cloneTaskDeliverables(ctx context.Context, tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT type, name, description, evaluation_points, sort_order
		FROM task_deliverables WHERE task_id = $1 ORDER BY sort_order
	`, oldTaskID)
	if err != nil {
		return err
	}

	type deliverableRow struct {
		typ, name   string
		description *string
		evalPoints  []byte
		sortOrder   int
	}
	var data []deliverableRow
	for rows.Next() {
		var dr deliverableRow
		if err := rows.Scan(&dr.typ, &dr.name, &dr.description, &dr.evalPoints, &dr.sortOrder); err != nil {
			continue
		}
		data = append(data, dr)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, dr := range data {
		_, err := tx.Exec(ctx, `
			INSERT INTO task_deliverables (id, task_id, type, name, description, evaluation_points, sort_order, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, uuid.NewString(), newTaskID, dr.typ, dr.name, dr.description, dr.evalPoints, dr.sortOrder, tenantID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskEvaluationMethods(ctx context.Context, tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config, version, is_enabled
		FROM task_evaluation_methods WHERE task_id = $1 AND tenant_id = $2
	`, oldTaskID, tenantID)
	if err != nil {
		slog.Error("[CloneScenario] query evaluation methods failed", "old_task_id", oldTaskID, "error", err)
		return err
	}

	type methodRow struct {
		oldConfigID, methodKey string
		weight                 float64
		evalObject             string
		scoreType              *string
		evalSubjects           []byte
		rubricTemplateID       *string
		resourceConfig         []byte
		version                int
		isEnabled              bool
	}
	var methodData []methodRow
	for rows.Next() {
		var mr methodRow
		if err := rows.Scan(&mr.oldConfigID, &mr.methodKey, &mr.weight, &mr.evalObject, &mr.scoreType, &mr.evalSubjects, &mr.rubricTemplateID, &mr.resourceConfig, &mr.version, &mr.isEnabled); err != nil {
			continue
		}
		methodData = append(methodData, mr)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, mr := range methodData {
		newConfigID := uuid.NewString()
		_, err := tx.Exec(ctx, `
			INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config, version, is_enabled)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, newConfigID, tenantID, newTaskID, mr.methodKey, mr.weight, mr.evalObject, mr.scoreType, mr.evalSubjects, mr.rubricTemplateID, mr.resourceConfig, mr.version, mr.isEnabled)
		if err != nil {
			slog.Error("[CloneScenario] insert evaluation method failed", "old_config_id", mr.oldConfigID, "new_config_id", newConfigID, "error", err)
			return err
		}

		if err := h.cloneTaskEvalPoints(ctx, tx, mr.oldConfigID, newConfigID, tenantID); err != nil {
			slog.Error("[CloneScenario] clone eval points failed", "old_config_id", mr.oldConfigID, "new_config_id", newConfigID, "error", err)
			return err
		}
		if err := h.cloneTaskReviewSteps(ctx, tx, mr.oldConfigID, newConfigID, tenantID); err != nil {
			slog.Error("[CloneScenario] clone review steps failed", "old_config_id", mr.oldConfigID, "new_config_id", newConfigID, "error", err)
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskEvalPoints(ctx context.Context, tx pgx.Tx, oldConfigID, newConfigID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order
		FROM task_eval_points WHERE config_id = $1
	`, oldConfigID)
	if err != nil {
		slog.Error("[CloneScenario] query eval points failed", "old_config_id", oldConfigID, "error", err)
		return err
	}

	type pointRow struct {
		name, scoringMethod                string
		description, subType               *string
		types                              []string
		weight                             float64
		gradeMapping                       []byte
		knowledgePointIDs, abilityPointIDs []string
		sortOrder                          int
	}
	var data []pointRow
	for rows.Next() {
		var pr pointRow
		if err := rows.Scan(&pr.name, &pr.description, &pr.subType, &pr.types, &pr.weight, &pr.scoringMethod, &pr.gradeMapping, &pr.knowledgePointIDs, &pr.abilityPointIDs, &pr.sortOrder); err != nil {
			continue
		}
		data = append(data, pr)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, pr := range data {
		_, err := tx.Exec(ctx, `
			INSERT INTO task_eval_points (id, tenant_id, config_id, name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		`, uuid.NewString(), tenantID, newConfigID, pr.name, pr.description, pr.subType, pr.types, pr.weight, pr.scoringMethod, pr.gradeMapping, pr.knowledgePointIDs, pr.abilityPointIDs, pr.sortOrder)
		if err != nil {
			slog.Error("[CloneScenario] insert eval point failed", "new_config_id", newConfigID, "error", err)
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskReviewSteps(ctx context.Context, tx pgx.Tx, oldConfigID, newConfigID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT label, description, enabled, subject_type, weight, sort_order
		FROM task_review_steps WHERE config_id = $1
	`, oldConfigID)
	if err != nil {
		slog.Error("[CloneScenario] query review steps failed", "old_config_id", oldConfigID, "error", err)
		return err
	}

	var steps []struct {
		label       string
		description *string
		enabled     bool
		subjectType *string
		weight      float64
		sortOrder   int
	}
	for rows.Next() {
		var sr struct {
			label       string
			description *string
			enabled     bool
			subjectType *string
			weight      float64
			sortOrder   int
		}
		if err := rows.Scan(&sr.label, &sr.description, &sr.enabled, &sr.subjectType, &sr.weight, &sr.sortOrder); err != nil {
			continue
		}
		steps = append(steps, sr)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, sr := range steps {
		_, err := tx.Exec(ctx, `
			INSERT INTO task_review_steps (id, tenant_id, config_id, label, description, enabled, subject_type, weight, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, uuid.NewString(), tenantID, newConfigID, sr.label, sr.description, sr.enabled, sr.subjectType, sr.weight, sr.sortOrder)
		if err != nil {
			slog.Error("[CloneScenario] insert review step failed", "new_config_id", newConfigID, "error", err)
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskResourceBindings(ctx context.Context, tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT resource_id FROM task_resource_bindings WHERE task_id = $1
	`, oldTaskID)
	if err != nil {
		slog.Error("[CloneScenario] query resource bindings failed", "old_task_id", oldTaskID, "error", err)
		return err
	}

	var resourceIDs []string
	for rows.Next() {
		var resourceID string
		if err := rows.Scan(&resourceID); err != nil {
			continue
		}
		resourceIDs = append(resourceIDs, resourceID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, resourceID := range resourceIDs {
		_, err := tx.Exec(ctx, `
			INSERT INTO task_resource_bindings (id, task_id, resource_id, tenant_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), newTaskID, resourceID, tenantID)
		if err != nil {
			slog.Error("[CloneScenario] insert resource binding failed", "new_task_id", newTaskID, "error", err)
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskKnowledgeBindings(ctx context.Context, tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT knowledge_point_id FROM task_knowledge_bindings WHERE task_id = $1
	`, oldTaskID)
	if err != nil {
		slog.Error("[CloneScenario] query knowledge bindings failed", "old_task_id", oldTaskID, "error", err)
		return err
	}

	var kpIDs []string
	for rows.Next() {
		var kpID string
		if err := rows.Scan(&kpID); err != nil {
			continue
		}
		kpIDs = append(kpIDs, kpID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, kpID := range kpIDs {
		_, err := tx.Exec(ctx, `
			INSERT INTO task_knowledge_bindings (id, task_id, knowledge_point_id, tenant_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), newTaskID, kpID, tenantID)
		if err != nil {
			slog.Error("[CloneScenario] insert knowledge binding failed", "new_task_id", newTaskID, "error", err)
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneTaskAbilityBindings(ctx context.Context, tx pgx.Tx, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT ability_point_id FROM task_ability_bindings WHERE task_id = $1
	`, oldTaskID)
	if err != nil {
		slog.Error("[CloneScenario] query ability bindings failed", "old_task_id", oldTaskID, "error", err)
		return err
	}

	var apIDs []string
	for rows.Next() {
		var apID string
		if err := rows.Scan(&apID); err != nil {
			continue
		}
		apIDs = append(apIDs, apID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, apID := range apIDs {
		_, err := tx.Exec(ctx, `
			INSERT INTO task_ability_bindings (id, task_id, ability_point_id, tenant_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), newTaskID, apID, tenantID)
		if err != nil {
			slog.Error("[CloneScenario] insert ability binding failed", "new_task_id", newTaskID, "error", err)
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) remapTaskDependencyIDs(ctx context.Context, tx pgx.Tx, taskID string, idMap map[string]string) error {
	var oldDeps []string
	err := tx.QueryRow(ctx, `SELECT dependency_ids FROM scenario_tasks WHERE id = $1`, taskID).Scan(&oldDeps)
	if err != nil || len(oldDeps) == 0 {
		return nil
	}

	newDeps := make([]string, 0, len(oldDeps))
	for _, old := range oldDeps {
		if newID, ok := idMap[old]; ok {
			newDeps = append(newDeps, newID)
		}
	}

	_, err = tx.Exec(ctx, `UPDATE scenario_tasks SET dependency_ids = $1 WHERE id = $2`,
		coalesceStringSlice(newDeps), taskID)
	return err
}

func (h *ScenarioCloneHandler) cloneScenarioWeights(ctx context.Context, tx pgx.Tx, oldScenarioID, newScenarioID string, taskIDMap map[string]string, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT task_id, weight FROM scenario_weight_configs WHERE scenario_id = $1
	`, oldScenarioID)
	if err != nil {
		slog.Error("[CloneScenario] query weights failed", "scenario_id", oldScenarioID, "error", err)
		return err
	}

	type weightRow struct {
		oldTaskID string
		weight    float64
	}
	var data []weightRow
	for rows.Next() {
		var wr weightRow
		if err := rows.Scan(&wr.oldTaskID, &wr.weight); err != nil {
			continue
		}
		if _, ok := taskIDMap[wr.oldTaskID]; !ok {
			continue
		}
		data = append(data, wr)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, wr := range data {
		newTaskID := taskIDMap[wr.oldTaskID]
		_, err := tx.Exec(ctx, `
			INSERT INTO scenario_weight_configs (id, scenario_id, task_id, weight, tenant_id)
			VALUES ($1, $2, $3, $4, $5)
		`, uuid.NewString(), newScenarioID, newTaskID, wr.weight, tenantID)
		if err != nil {
			slog.Error("[CloneScenario] insert weight failed", "new_task_id", newTaskID, "error", err)
			return err
		}
	}
	return nil
}

func (h *ScenarioCloneHandler) cloneScenarioGradeMappings(ctx context.Context, tx pgx.Tx, oldScenarioID, newScenarioID string, taskIDMap map[string]string, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT task_id, level, min_score, max_score, description, color
		FROM scenario_grade_mappings WHERE scenario_id = $1
	`, oldScenarioID)
	if err != nil {
		slog.Error("[CloneScenario] query grade mappings failed", "scenario_id", oldScenarioID, "error", err)
		return err
	}

	type gradeRow struct {
		oldTaskID          *string
		level              string
		minScore, maxScore float64
		description, color *string
	}
	var data []gradeRow
	for rows.Next() {
		var gr gradeRow
		if err := rows.Scan(&gr.oldTaskID, &gr.level, &gr.minScore, &gr.maxScore, &gr.description, &gr.color); err != nil {
			continue
		}
		if gr.oldTaskID != nil {
			if _, ok := taskIDMap[*gr.oldTaskID]; !ok {
				continue
			}
		}
		data = append(data, gr)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, gr := range data {
		var newTaskID *string
		if gr.oldTaskID != nil {
			mapped := taskIDMap[*gr.oldTaskID]
			newTaskID = &mapped
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO scenario_grade_mappings (id, scenario_id, task_id, level, min_score, max_score, description, color, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, uuid.NewString(), newScenarioID, newTaskID, gr.level, gr.minScore, gr.maxScore, gr.description, gr.color, tenantID)
		if err != nil {
			slog.Error("[CloneScenario] insert grade mapping failed", "error", err)
			return err
		}
	}
	return nil
}
