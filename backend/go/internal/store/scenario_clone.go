package store

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// SourceScenarioFields 场景克隆源字段。
type SourceScenarioFields struct {
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

// ScenarioCloneStore 场景克隆持久化（事务内多表复制）。
type ScenarioCloneStore struct {
	q Queryer
}

// NewScenarioCloneStore 创建场景克隆 store。
func NewScenarioCloneStore(q Queryer) *ScenarioCloneStore {
	return &ScenarioCloneStore{q: q}
}

// FetchSource 查询源场景字段。
func (s *ScenarioCloneStore) FetchSource(ctx context.Context, id string) (*SourceScenarioFields, error) {
	var f SourceScenarioFields
	err := s.q.QueryRow(ctx, `
		SELECT name, code, cover_image, career_position_id, industry_ids,
			profession_ids, batch_id, difficulty, version, background,
			delivery_goal, co_builder_ids, tenant_id
		FROM scenarios WHERE id = $1
	`, id).Scan(&f.Name, &f.Code, &f.CoverImage, &f.CareerPositionID,
		&f.IndustryIDs, &f.ProfessionIDs, &f.BatchID, &f.Difficulty,
		&f.Version, &f.Background, &f.DeliveryGoal, &f.CoBuilderIDs, &f.TenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &f, nil
}

// CloneScenario 在事务内克隆场景及全部关联（任务/交付物/评估方法/评估点/评审步骤/绑定/权重/等级映射）。
// 返回新场景 ID 与生成的新 code。
func (s *ScenarioCloneStore) CloneScenario(ctx context.Context, tx Queryer, tenantID, oldScenarioID, newName, creatorID string, src *SourceScenarioFields) (string, string, error) {
	newID := uuid.NewString()
	newCode := GenerateUniqueScenarioCode(ctx, tx, tenantID, src.Code)

	if _, err := tx.Exec(ctx, `
		INSERT INTO scenarios (id, name, code, cover_image, career_position_id, industry_ids,
			profession_ids, batch_id, difficulty, version, status, background,
			delivery_goal, creator_id, co_builder_ids, tenant_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11, $12, $13, $14, $15)
	`, newID, newName, newCode, src.CoverImage, src.CareerPositionID, src.IndustryIDs,
		src.ProfessionIDs, src.BatchID, src.Difficulty, src.Version, src.Background,
		src.DeliveryGoal, creatorID, src.CoBuilderIDs, tenantID); err != nil {
		return "", "", err
	}

	taskIDMap := make(map[string]string)
	taskRows, err := tx.Query(ctx, `
		SELECT id, name, code, sort_order, description, detailed_description, description_pdf,
			estimated_hours, task_type, difficulty, background, dependency_ids,
			knowledge_point_ids, ability_point_ids, resource_ids, eval_data
		FROM scenario_tasks WHERE scenario_id = $1 ORDER BY sort_order
	`, oldScenarioID)
	if err != nil {
		return "", "", err
	}
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
	for taskRows.Next() {
		var tr taskRow
		if err := taskRows.Scan(&tr.oldID, &tr.name, &tr.code, &tr.sortOrder,
			&tr.description, &tr.detailedDescription, &tr.descriptionPdf,
			&tr.estimatedHours, &tr.taskType, &tr.difficulty, &tr.background,
			&tr.dependencyIDs, &tr.knowledgePointIDs, &tr.abilityPointIDs, &tr.resourceIDs, &tr.evalData); err != nil {
			slog.Warn("克隆行扫描失败，已跳过该行", "error", err)
			continue
		}
		taskData = append(taskData, tr)
	}
	taskRows.Close()
	if err := taskRows.Err(); err != nil {
		return "", "", err
	}

	for _, tr := range taskData {
		newTaskID := uuid.NewString()
		taskIDMap[tr.oldID] = newTaskID

		if _, err := tx.Exec(ctx, `INSERT INTO scenario_tasks (id, `+TaskInsertColumns+`)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
		`, newTaskID, newID, tr.name, tr.code, tr.sortOrder, tr.description, tr.detailedDescription, tr.descriptionPdf,
			tr.estimatedHours, tr.taskType, tr.difficulty, tr.background,
			tr.dependencyIDs, false, nil,
			tr.knowledgePointIDs, tr.abilityPointIDs, tr.resourceIDs, tr.evalData, tenantID); err != nil {
			return "", "", err
		}

		if err := s.cloneTaskDeliverables(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			return "", "", err
		}
		if err := s.cloneTaskEvaluationMethods(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			return "", "", err
		}
		if err := s.cloneTaskResourceBindings(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			return "", "", err
		}
		if err := s.cloneTaskKnowledgeBindings(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			return "", "", err
		}
		if err := s.cloneTaskAbilityBindings(ctx, tx, tr.oldID, newTaskID, tenantID); err != nil {
			return "", "", err
		}
	}

	for _, newTaskID := range taskIDMap {
		if err := s.remapTaskDependencyIDs(ctx, tx, newTaskID, taskIDMap); err != nil {
			return "", "", err
		}
	}

	if err := s.cloneScenarioWeights(ctx, tx, oldScenarioID, newID, taskIDMap, tenantID); err != nil {
		return "", "", err
	}
	if err := s.cloneScenarioGradeMappings(ctx, tx, oldScenarioID, newID, taskIDMap, tenantID); err != nil {
		return "", "", err
	}

	return newID, newCode, nil
}

// TaskInsertColumns 任务插入列（与 scenario_task_handler 的 taskInsertColumns 一致）。
const TaskInsertColumns = `scenario_id, name, code, sort_order, description, detailed_description, description_pdf,
	estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced, source_scenario_id,
	knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id`

// GenerateUniqueScenarioCode 生成不冲突的场景克隆 code（srcCode-clone[-N]）。
func GenerateUniqueScenarioCode(ctx context.Context, q Queryer, tenantID, srcCode string) string {
	base := srcCode + "-clone"
	var exists bool
	err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM scenarios WHERE tenant_id = $1 AND code = $2)`, tenantID, base).Scan(&exists)
	if err != nil || !exists {
		return base
	}
	for i := 2; i < 1000; i++ {
		candidate := fmt.Sprintf("%s-%d", base, i)
		err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM scenarios WHERE tenant_id = $1 AND code = $2)`, tenantID, candidate).Scan(&exists)
		if err != nil || !exists {
			return candidate
		}
	}
	return base + "-" + uuid.NewString()[:8]
}

func (s *ScenarioCloneStore) cloneTaskDeliverables(ctx context.Context, tx Queryer, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT type, name, description, evaluation_points, sort_order
		FROM task_deliverables WHERE task_id = $1 ORDER BY sort_order
	`, oldTaskID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type row struct {
		typ, name   string
		description *string
		evalPoints  []byte
		sortOrder   int
	}
	var data []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.typ, &r.name, &r.description, &r.evalPoints, &r.sortOrder); err != nil {
			slog.Warn("克隆行扫描失败，已跳过该行", "error", err)
			continue
		}
		data = append(data, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, r := range data {
		if _, err := tx.Exec(ctx, `
			INSERT INTO task_deliverables (id, task_id, type, name, description, evaluation_points, sort_order, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, uuid.NewString(), newTaskID, r.typ, r.name, r.description, r.evalPoints, r.sortOrder, tenantID); err != nil {
			return err
		}
	}
	return nil
}

func (s *ScenarioCloneStore) cloneTaskEvaluationMethods(ctx context.Context, tx Queryer, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT id, method_key, weight, eval_object, score_type, eval_subjects, standard_name, standard_mode, resource_config, version, is_enabled
		FROM task_evaluation_methods WHERE task_id = $1 AND tenant_id = $2
	`, oldTaskID, tenantID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type row struct {
		oldConfigID, methodKey string
		weight                 float64
		evalObject             string
		scoreType              *string
		evalSubjects           []byte
		standardName           *string
		standardMode           *string
		resourceConfig         []byte
		version                int
		isEnabled              bool
	}
	var data []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.oldConfigID, &r.methodKey, &r.weight, &r.evalObject, &r.scoreType, &r.evalSubjects, &r.standardName, &r.standardMode, &r.resourceConfig, &r.version, &r.isEnabled); err != nil {
			return err
		}
		data = append(data, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, r := range data {
		newConfigID := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, eval_object, score_type, eval_subjects, standard_name, standard_mode, resource_config, version, is_enabled)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		`, newConfigID, tenantID, newTaskID, r.methodKey, r.weight, r.evalObject, r.scoreType, r.evalSubjects, r.standardName, r.standardMode, r.resourceConfig, r.version, r.isEnabled); err != nil {
			return err
		}
		if err := s.cloneTaskEvalPoints(ctx, tx, r.oldConfigID, newConfigID, tenantID); err != nil {
			return err
		}
		if err := s.cloneTaskScoreRules(ctx, tx, r.oldConfigID, newConfigID, tenantID); err != nil {
			return err
		}
		if err := s.cloneTaskReviewSteps(ctx, tx, r.oldConfigID, newConfigID, tenantID); err != nil {
			return err
		}
	}
	return nil
}

func (s *ScenarioCloneStore) cloneTaskScoreRules(ctx context.Context, tx Queryer, oldConfigID, newConfigID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT name, description, rule, weight, sort_order
		FROM task_eval_score_rules WHERE config_id = $1
	`, oldConfigID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type row struct {
		name              string
		description, rule *string
		weight            float64
		sortOrder         int
	}
	var data []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.name, &r.description, &r.rule, &r.weight, &r.sortOrder); err != nil {
			return err
		}
		data = append(data, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, r := range data {
		if _, err := tx.Exec(ctx, `
			INSERT INTO task_eval_score_rules (id, tenant_id, config_id, name, description, rule, weight, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, uuid.NewString(), tenantID, newConfigID, r.name, r.description, r.rule, r.weight, r.sortOrder); err != nil {
			return err
		}
	}
	return nil
}

func (s *ScenarioCloneStore) cloneTaskEvalPoints(ctx context.Context, tx Queryer, oldConfigID, newConfigID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order
		FROM task_eval_points WHERE config_id = $1
	`, oldConfigID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type row struct {
		name, scoringMethod                string
		description, subType               *string
		types                              []string
		weight                             float64
		gradeMapping                       []byte
		knowledgePointIDs, abilityPointIDs []string
		sortOrder                          int
	}
	var data []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.name, &r.description, &r.subType, &r.types, &r.weight, &r.scoringMethod, &r.gradeMapping, &r.knowledgePointIDs, &r.abilityPointIDs, &r.sortOrder); err != nil {
			return err
		}
		data = append(data, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, r := range data {
		if _, err := tx.Exec(ctx, `
			INSERT INTO task_eval_points (id, tenant_id, config_id, name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		`, uuid.NewString(), tenantID, newConfigID, r.name, r.description, r.subType, r.types, r.weight, r.scoringMethod, r.gradeMapping, r.knowledgePointIDs, r.abilityPointIDs, r.sortOrder); err != nil {
			return err
		}
	}
	return nil
}

func (s *ScenarioCloneStore) cloneTaskReviewSteps(ctx context.Context, tx Queryer, oldConfigID, newConfigID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT label, description, enabled, subject_type, weight, sort_order
		FROM task_review_steps WHERE config_id = $1
	`, oldConfigID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type row struct {
		label       string
		description *string
		enabled     bool
		subjectType *string
		weight      float64
		sortOrder   int
	}
	var data []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.label, &r.description, &r.enabled, &r.subjectType, &r.weight, &r.sortOrder); err != nil {
			return err
		}
		data = append(data, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, r := range data {
		if _, err := tx.Exec(ctx, `
			INSERT INTO task_review_steps (id, tenant_id, config_id, label, description, enabled, subject_type, weight, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, uuid.NewString(), tenantID, newConfigID, r.label, r.description, r.enabled, r.subjectType, r.weight, r.sortOrder); err != nil {
			return err
		}
	}
	return nil
}

func (s *ScenarioCloneStore) cloneTaskResourceBindings(ctx context.Context, tx Queryer, oldTaskID, newTaskID, tenantID string) error {
	return s.cloneSimpleBindings(ctx, tx, "task_resource_bindings", "resource_id", oldTaskID, newTaskID, tenantID)
}

func (s *ScenarioCloneStore) cloneTaskKnowledgeBindings(ctx context.Context, tx Queryer, oldTaskID, newTaskID, tenantID string) error {
	return s.cloneSimpleBindings(ctx, tx, "task_knowledge_bindings", "knowledge_point_id", oldTaskID, newTaskID, tenantID)
}

func (s *ScenarioCloneStore) cloneTaskAbilityBindings(ctx context.Context, tx Queryer, oldTaskID, newTaskID, tenantID string) error {
	return s.cloneSimpleBindings(ctx, tx, "task_ability_bindings", "ability_point_id", oldTaskID, newTaskID, tenantID)
}

// cloneSimpleBindings 通用绑定表克隆（task_X_bindings）。
func (s *ScenarioCloneStore) cloneSimpleBindings(ctx context.Context, tx Queryer, table, targetCol, oldTaskID, newTaskID, tenantID string) error {
	rows, err := tx.Query(ctx, `SELECT `+targetCol+` FROM `+table+` WHERE task_id = $1`, oldTaskID)
	if err != nil {
		return err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			slog.Warn("克隆行扫描失败，已跳过该行", "error", err)
			continue
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := tx.Exec(ctx, `
			INSERT INTO `+table+` (id, task_id, `+targetCol+`, tenant_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), newTaskID, id, tenantID); err != nil {
			return err
		}
	}
	return nil
}

func (s *ScenarioCloneStore) remapTaskDependencyIDs(ctx context.Context, tx Queryer, taskID string, idMap map[string]string) error {
	var oldDeps []string
	err := tx.QueryRow(ctx, `SELECT dependency_ids FROM scenario_tasks WHERE id = $1`, taskID).Scan(&oldDeps)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil // 任务不存在视为无需重映射
		}
		return err // 真实 DB 错误上抛，不静默吞掉（克隆核心路径）
	}
	if len(oldDeps) == 0 {
		return nil
	}
	newDeps := make([]string, 0, len(oldDeps))
	for _, old := range oldDeps {
		if newID, ok := idMap[old]; ok {
			newDeps = append(newDeps, newID)
		}
	}
	_, err = tx.Exec(ctx, `UPDATE scenario_tasks SET dependency_ids = $1 WHERE id = $2`, newDeps, taskID)
	return err
}

func (s *ScenarioCloneStore) cloneScenarioWeights(ctx context.Context, tx Queryer, oldScenarioID, newScenarioID string, taskIDMap map[string]string, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT task_id, weight FROM scenario_weight_configs WHERE scenario_id = $1
	`, oldScenarioID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type row struct {
		oldTaskID string
		weight    float64
	}
	var data []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.oldTaskID, &r.weight); err != nil {
			slog.Warn("克隆行扫描失败，已跳过该行", "error", err)
			continue
		}
		if _, ok := taskIDMap[r.oldTaskID]; !ok {
			continue
		}
		data = append(data, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, r := range data {
		newTaskID := taskIDMap[r.oldTaskID]
		if _, err := tx.Exec(ctx, `
			INSERT INTO scenario_weight_configs (id, scenario_id, task_id, weight, tenant_id)
			VALUES ($1, $2, $3, $4, $5)
		`, uuid.NewString(), newScenarioID, newTaskID, r.weight, tenantID); err != nil {
			return err
		}
	}
	return nil
}

func (s *ScenarioCloneStore) cloneScenarioGradeMappings(ctx context.Context, tx Queryer, oldScenarioID, newScenarioID string, taskIDMap map[string]string, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT task_id, level, min_score, max_score, description, color
		FROM scenario_grade_mappings WHERE scenario_id = $1
	`, oldScenarioID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type row struct {
		oldTaskID          *string
		level              string
		minScore, maxScore float64
		description, color *string
	}
	var data []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.oldTaskID, &r.level, &r.minScore, &r.maxScore, &r.description, &r.color); err != nil {
			slog.Warn("克隆行扫描失败，已跳过该行", "error", err)
			continue
		}
		if r.oldTaskID != nil {
			if _, ok := taskIDMap[*r.oldTaskID]; !ok {
				continue
			}
		}
		data = append(data, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, r := range data {
		var newTaskID *string
		if r.oldTaskID != nil {
			mapped := taskIDMap[*r.oldTaskID]
			newTaskID = &mapped
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO scenario_grade_mappings (id, scenario_id, task_id, level, min_score, max_score, description, color, tenant_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, uuid.NewString(), newScenarioID, newTaskID, r.level, r.minScore, r.maxScore, r.description, r.color, tenantID); err != nil {
			return err
		}
	}
	return nil
}
