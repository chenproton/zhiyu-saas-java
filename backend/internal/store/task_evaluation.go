package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// TaskEvaluationStore 任务测评方式持久化（方法/评估点/评审步骤/rubric 模板）。
type TaskEvaluationStore struct {
	q Queryer
}

// NewTaskEvaluationStore 创建测评 store。
func NewTaskEvaluationStore(q Queryer) *TaskEvaluationStore {
	return &TaskEvaluationStore{q: q}
}

// ListRubricTemplates 查询评分模板列表。
func (s *TaskEvaluationStore) ListRubricTemplates(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.RubricTemplate]) ([]domain.RubricTemplate, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanRubricTemplates)
}

// ListConfig 返回评分模板列表查询配置，SQL 片段沉淀在 store 层。
func (s *TaskEvaluationStore) ListConfig() ListQueryConfig[domain.RubricTemplate] {
	return ListQueryConfig[domain.RubricTemplate]{
		Table:         "rubric_templates",
		SelectColumns: "id, tenant_id, name, mode, types, description, data, is_deleted, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		SearchParam:   "keyword",
		OrderBy:       "updated_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			qb.AddCondition("is_deleted = false")
		},
	}
}

// GetRubricTemplate 查询单个评分模板。
func (s *TaskEvaluationStore) GetRubricTemplate(ctx context.Context, id string) (*domain.RubricTemplate, error) {
	var t domain.RubricTemplate
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, mode, types, description, data, is_deleted, created_at, updated_at
		FROM rubric_templates WHERE id = $1
	`, id).Scan(&t.ID, &t.TenantID, &t.Name, &t.Mode, &t.Types, &t.Description, &t.Data, &t.IsDeleted, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// CreateRubricTemplate 创建评分模板。
func (s *TaskEvaluationStore) CreateRubricTemplate(ctx context.Context, tenantID string, p *RubricTemplateParams) (*domain.RubricTemplate, error) {
	now := time.Now()
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO rubric_templates (tenant_id, name, mode, types, description, data, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, tenantID, p.Name, p.Mode, p.Types, p.Description, p.Data, now, now).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetRubricTemplate(ctx, id)
}

// UpdateRubricTemplate 更新评分模板。
func (s *TaskEvaluationStore) UpdateRubricTemplate(ctx context.Context, id string, p *RubricTemplateParams) (*domain.RubricTemplate, error) {
	now := time.Now()
	if _, err := s.GetRubricTemplate(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE rubric_templates SET name = $1, mode = $2, types = $3, description = $4, data = $5, updated_at = $6
		WHERE id = $7
	`, p.Name, p.Mode, p.Types, p.Description, p.Data, now, id); err != nil {
		return nil, err
	}
	return s.GetRubricTemplate(ctx, id)
}

// DeleteRubricTemplate 软删除评分模板。
func (s *TaskEvaluationStore) DeleteRubricTemplate(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `
		UPDATE rubric_templates SET is_deleted = true, updated_at = NOW()
		WHERE id = $1
	`, id)
	return err
}

// RubricTemplateParams 评分模板参数。
type RubricTemplateParams struct {
	Name        string
	Mode        string
	Types       []string
	Description *string
	Data        domain.JSONMap
}

// FetchTaskMethods 查询任务全部测评方式（含评估点/评审步骤）。
func (s *TaskEvaluationStore) FetchTaskMethods(ctx context.Context, taskID, tenantID string) ([]domain.TaskEvaluationMethod, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, standard_name, standard_mode, resource_config, version, is_enabled
		FROM task_evaluation_methods
		WHERE task_id = $1 AND tenant_id = $2
		ORDER BY method_key
	`, taskID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var methods []domain.TaskEvaluationMethod
	var configIDs []string
	for rows.Next() {
		var m domain.TaskEvaluationMethod
		if err := rows.Scan(&m.ID, &m.TaskID, &m.MethodKey, &m.Weight, &m.EvalObject, &m.ScoreType, &m.EvalSubjects, &m.RubricTemplateID, &m.StandardName, &m.StandardMode, &m.ResourceConfig, &m.Version, &m.IsEnabled); err != nil {
			return nil, err
		}
		methods = append(methods, m)
		configIDs = append(configIDs, m.ID)
	}
	if len(configIDs) == 0 {
		return methods, nil
	}

	evalPointsByConfig := make(map[string][]domain.TaskEvalPoint)
	scoreRulesByConfig := make(map[string][]domain.TaskScoreRule)
	reviewStepsByConfig := make(map[string][]domain.TaskReviewStep)

	epRows, err := s.q.Query(ctx, `
		SELECT id, config_id, name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order
		FROM task_eval_points
		WHERE config_id = ANY($1)
		ORDER BY sort_order
	`, configIDs)
	if err != nil {
		return nil, err
	}
	defer epRows.Close()
	for epRows.Next() {
		var p domain.TaskEvalPoint
		if err := epRows.Scan(&p.ID, &p.ConfigID, &p.Name, &p.Description, &p.SubType, &p.Types, &p.Weight, &p.ScoringMethod, &p.GradeMapping, &p.KnowledgePointIDs, &p.AbilityPointIDs, &p.SortOrder); err != nil {
			continue
		}
		evalPointsByConfig[p.ConfigID] = append(evalPointsByConfig[p.ConfigID], p)
	}

	srRows, err := s.q.Query(ctx, `
		SELECT id, config_id, name, description, rule, weight, sort_order
		FROM task_eval_score_rules
		WHERE config_id = ANY($1)
		ORDER BY sort_order
	`, configIDs)
	if err != nil {
		return nil, err
	}
	defer srRows.Close()
	for srRows.Next() {
		var sr domain.TaskScoreRule
		if err := srRows.Scan(&sr.ID, &sr.ConfigID, &sr.Name, &sr.Description, &sr.Rule, &sr.Weight, &sr.SortOrder); err != nil {
			continue
		}
		scoreRulesByConfig[sr.ConfigID] = append(scoreRulesByConfig[sr.ConfigID], sr)
	}

	rsRows, err := s.q.Query(ctx, `
		SELECT id, config_id, label, description, enabled, subject_type, weight, sort_order, assigned_user_ids
		FROM task_review_steps
		WHERE config_id = ANY($1)
		ORDER BY sort_order
	`, configIDs)
	if err != nil {
		return nil, err
	}
	defer rsRows.Close()
	for rsRows.Next() {
		var st domain.TaskReviewStep
		if err := rsRows.Scan(&st.ID, &st.ConfigID, &st.Label, &st.Description, &st.Enabled, &st.SubjectType, &st.Weight, &st.SortOrder, &st.AssignedUserIDs); err != nil {
			continue
		}
		if st.AssignedUserIDs == nil {
			st.AssignedUserIDs = []string{}
		}
		reviewStepsByConfig[st.ConfigID] = append(reviewStepsByConfig[st.ConfigID], st)
	}

	for i := range methods {
		methods[i].EvalPoints = evalPointsByConfig[methods[i].ID]
		methods[i].ScoreRules = scoreRulesByConfig[methods[i].ID]
		methods[i].ReviewSteps = reviewStepsByConfig[methods[i].ID]
	}
	return methods, nil
}

// LockTaskEval 以租户+任务粒度的 advisory 锁串行化测评方式保存（须在事务内调用）。
func (s *TaskEvaluationStore) LockTaskEval(ctx context.Context, q Queryer, tenantID, taskID string) error {
	_, err := q.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, tenantID+"|"+taskID)
	return err
}

// MaxMethodVersion 查询任务当前最大版本（乐观锁）。
func (s *TaskEvaluationStore) MaxMethodVersion(ctx context.Context, taskID, tenantID string) (int, error) {
	var v int
	err := s.q.QueryRow(ctx, `
		SELECT COALESCE(MAX(version), 0) FROM task_evaluation_methods WHERE task_id = $1 AND tenant_id = $2
	`, taskID, tenantID).Scan(&v)
	return v, err
}

// TaskName 查询任务名称。
func (s *TaskEvaluationStore) TaskName(ctx context.Context, q Queryer, taskID string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM scenario_tasks WHERE id = $1`, taskID).Scan(&name)
	return name, err
}

// TaskScenarioName 查询任务所属场景名称。
func (s *TaskEvaluationStore) TaskScenarioName(ctx context.Context, q Queryer, taskID string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `
		SELECT COALESCE(sc.name, '') FROM scenario_tasks st
		JOIN scenarios sc ON sc.id = st.scenario_id
		WHERE st.id = $1
	`, taskID).Scan(&name)
	return name, err
}

// SaveTaskMethod 保存单个测评方式（upsert 方法 + 重写评估点/评分规则/评审步骤）。
// 只按 payload 更新方法本身，不触碰 payload 之外的方法：前端状态缺失（如导入期间页面已打开）时，
// 保存不会把未知方法静默禁用。
// 评价标准为"纯复制"语义：任务侧独立保存标准信息与量规/评分规则数据，不保留模板引用（rubric_template_id 恒为 NULL）。
func (s *TaskEvaluationStore) SaveTaskMethod(ctx context.Context, tx Queryer, tenantID, taskID string, newVersion int, m *TaskMethodInput) error {
	var configID string
	err := tx.QueryRow(ctx, `
		INSERT INTO task_evaluation_methods (tenant_id, task_id, method_key, weight, eval_object, score_type, eval_subjects, standard_name, standard_mode, resource_config, version, is_enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (task_id, method_key) DO UPDATE SET
			weight = EXCLUDED.weight,
			eval_object = EXCLUDED.eval_object,
			score_type = EXCLUDED.score_type,
			eval_subjects = EXCLUDED.eval_subjects,
			standard_name = EXCLUDED.standard_name,
			standard_mode = EXCLUDED.standard_mode,
			resource_config = EXCLUDED.resource_config,
			version = EXCLUDED.version,
			is_enabled = EXCLUDED.is_enabled,
			updated_at = now()
		RETURNING id
	`, tenantID, taskID, m.MethodKey, m.Weight, m.EvalObject, m.ScoreType, m.EvalSubjects, m.StandardName, m.StandardMode, m.ResourceConfig, newVersion, m.IsEnabled).Scan(&configID)
	if err != nil {
		return err
	}

	if !m.IsEnabled {
		if _, err := tx.Exec(ctx, `DELETE FROM task_eval_points WHERE config_id = $1`, configID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM task_eval_score_rules WHERE config_id = $1`, configID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM task_review_steps WHERE config_id = $1`, configID); err != nil {
			return err
		}
		return nil
	}
	if _, err := tx.Exec(ctx, `DELETE FROM task_eval_points WHERE config_id = $1`, configID); err != nil {
		return err
	}
	for _, ep := range m.EvalPoints {
		if _, err := tx.Exec(ctx, `
			INSERT INTO task_eval_points (tenant_id, config_id, name, description, sub_type, types, weight, scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, tenantID, configID, ep.Name, ep.Description, ep.SubType, ep.Types,
			ep.Weight, ep.ScoringMethod, ep.GradeMapping,
			ep.KnowledgePointIDs, ep.AbilityPointIDs, ep.SortOrder); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM task_eval_score_rules WHERE config_id = $1`, configID); err != nil {
		return err
	}
	for _, sr := range m.ScoreRules {
		if _, err := tx.Exec(ctx, `
			INSERT INTO task_eval_score_rules (tenant_id, config_id, name, description, rule, weight, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, tenantID, configID, sr.Name, sr.Description, sr.Rule, sr.Weight, sr.SortOrder); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM task_review_steps WHERE config_id = $1`, configID); err != nil {
		return err
	}
	for _, rs := range m.ReviewSteps {
		if _, err := tx.Exec(ctx, `
			INSERT INTO task_review_steps (tenant_id, config_id, label, description, enabled, subject_type, weight, sort_order, assigned_user_ids)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, tenantID, configID, rs.Label, rs.Description, rs.Enabled, rs.SubjectType, rs.Weight, rs.SortOrder, rs.AssignedUserIDs); err != nil {
			return err
		}
	}
	return nil
}

// TaskMethodInput 测评方法输入（service 层组装）。
type TaskMethodInput struct {
	MethodKey      string
	Weight         float64
	EvalObject     string
	ScoreType      *string
	EvalSubjects   domain.JSONSlice
	StandardName   *string
	StandardMode   *string
	ResourceConfig domain.JSONMap
	IsEnabled      bool
	EvalPoints     []TaskEvalPointInput
	ScoreRules     []TaskScoreRuleInput
	ReviewSteps    []TaskReviewStepInput
}

// TaskScoreRuleInput 评分规则项输入。
type TaskScoreRuleInput struct {
	Name        string
	Description *string
	Rule        *string
	Weight      float64
	SortOrder   int
}

// TaskEvalPointInput 评估点输入。
type TaskEvalPointInput struct {
	Name              string
	Description       *string
	SubType           *string
	Types             []string
	Weight            float64
	ScoringMethod     string
	GradeMapping      domain.JSONSlice
	KnowledgePointIDs []string
	AbilityPointIDs   []string
	SortOrder         int
}

// TaskReviewStepInput 评审步骤输入。
type TaskReviewStepInput struct {
	Label       string
	Description *string
	Enabled     bool
	SubjectType *string
	Weight      float64
	SortOrder   int
	// AssignedUserIDs 任务级企业导师分配（仅 subject_type='enterprise_mentor' 持久化）。
	AssignedUserIDs []string
}

// EnsureExamUsageForMethod 确保试卷/题库/随堂测方法存在临时考试与使用记录。
func (s *TaskEvaluationStore) EnsureExamUsageForMethod(ctx context.Context, tx Queryer, tenantID, taskID, taskName, creatorID, methodKey string, resourceConfig domain.JSONMap) (domain.JSONMap, error) {
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

	if methodKey == "question_bank" || methodKey == "quiz" {
		questionIDs := GetStringSliceFromJSONMap(resourceConfig, "questionIds")
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
			name := fmt.Sprintf("%s-%s-%s", taskName, label, taskID)
			id, err := s.createTempExam(ctx, tx, tenantID, name, duration, creatorID)
			if err != nil {
				return resourceConfig, err
			}
			examID = id
			resourceConfig["examId"] = examID
		}
		if err := SyncExamQuestions(ctx, tx, tenantID, examID, questionIDs, getFloatMapFromJSONMap(resourceConfig, "questionScores")); err != nil {
			return resourceConfig, err
		}
	}

	if examID == "" {
		return resourceConfig, nil
	}
	startTime, endTime := ExtractExamUsageWindow(resourceConfig)
	duration := ExtractExamUsageDuration(resourceConfig, methodKey)
	activationMode := ResolveActivationMode(resourceConfig, methodKey)
	if usageID == "" {
		// 名称前缀：场景名-任务名（示例：软件项目经理场景2-任务 1）
		scenarioName, _ := s.TaskScenarioName(ctx, tx, taskID)
		taskDisplayName, _ := s.TaskName(ctx, tx, taskID)
		prefix := strings.TrimSpace(strings.Join([]string{scenarioName, taskDisplayName}, "-"))
		if prefix == "-" || prefix == "" {
			prefix = "场景任务"
		}
		id, err := s.createTempExamUsage(ctx, tx, tenantID, examID, taskID, creatorID, startTime, endTime, duration, activationMode, methodKey, label, prefix)
		if err != nil {
			return resourceConfig, err
		}
		usageID = id
		resourceConfig["usageId"] = usageID
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE exam_usages SET start_time = $1, end_time = $2, duration = $3, activation_mode = $4,
				status = CASE WHEN $4::varchar = 'always' THEN 'published' ELSE status END,
				updated_at = NOW()
			WHERE id = $5
		`, startTime, endTime, duration, activationMode, usageID); err != nil {
			return resourceConfig, fmt.Errorf("update exam usage window: %w", err)
		}
	}
	return resourceConfig, nil
}

// ResolveActivationMode 解析测评方式启用条件：随时作答/定时启停/手动启停。
// 未配置时按方法类型默认：题库/随堂测视为随时作答，试卷视为手动启停。
func ResolveActivationMode(resourceConfig domain.JSONMap, methodKey string) string {
	if mode, _ := resourceConfig["activationMode"].(string); mode != "" {
		return mode
	}
	if methodKey == "question_bank" || methodKey == "quiz" {
		return "always"
	}
	return "manual"
}

func (s *TaskEvaluationStore) createTempExam(ctx context.Context, tx Queryer, tenantID, name string, duration int, creatorID string) (string, error) {
	var existingID string
	err := tx.QueryRow(ctx, `
		SELECT id FROM exams WHERE tenant_id = $1 AND name = $2 AND is_temp = TRUE LIMIT 1
	`, tenantID, name).Scan(&existingID)
	if err == nil && existingID != "" {
		return existingID, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("lookup temp exam: %w", err)
	}
	id := uuid.NewString()
	code, err := GenerateUniqueEntityCode(ctx, tx, "SJ", "exams", tenantID)
	if err != nil {
		return "", fmt.Errorf("generate exam code: %w", err)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration, cover_image,
			collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, creator_id, is_temp)
		VALUES ($1, $2, $3, $4, '', 'draft', 0, $5, NULL, '{}', '{}', NULL, 'V1.0', 'mine', $6, TRUE)
	`, id, tenantID, code, name, duration, creatorID)
	if err != nil {
		return "", fmt.Errorf("create temp exam: %w", err)
	}
	return id, nil
}

func (s *TaskEvaluationStore) createTempExamUsage(ctx context.Context, tx Queryer, tenantID, examID, taskID, creatorID string, startTime, endTime *string, duration *int, activationMode, methodKey, label, prefix string) (string, error) {
	var existingID string
	err := tx.QueryRow(ctx, `
		SELECT id FROM exam_usages
		WHERE tenant_id = $1 AND exam_id = $2 AND target_type = 'task' AND $3::uuid = ANY(target_ids) AND status = 'draft'
		LIMIT 1
	`, tenantID, examID, taskID).Scan(&existingID)
	if err == nil && existingID != "" {
		if _, err := tx.Exec(ctx, `
			UPDATE exam_usages SET start_time = $1, end_time = $2, duration = $3, activation_mode = $4,
				status = CASE WHEN $4::varchar = 'always' THEN 'published' ELSE status END,
				updated_at = NOW()
			WHERE id = $5
		`, startTime, endTime, duration, activationMode, existingID); err != nil {
			return "", fmt.Errorf("update temp exam usage: %w", err)
		}
		return existingID, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("lookup temp exam usage: %w", err)
	}
	id := uuid.NewString()
	var creator any
	if creatorID != "" {
		creator = creatorID
	}
	// 初始状态：随时作答 → 已发布（一直可作答）；定时/手动启停 → 草稿（开启后发布）
	status := "draft"
	if activationMode == "always" {
		status = "published"
	}
	// 名称：{场景名-任务名}-{测评类型}-{YYYYMMDD}-{序号}（同一天多个测评序号递增）
	name, err := NextAutoUsageName(ctx, tx, tenantID, "task", prefix, label)
	if err != nil {
		return "", fmt.Errorf("生成考试安排名称失败: %w", err)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, activation_mode, creator_id)
		VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, 'task', $8, $9, $10, $11)
	`, id, tenantID, examID, name, startTime, endTime, duration, []string{taskID}, status, activationMode, creator)
	if err != nil {
		return "", fmt.Errorf("create temp exam usage: %w", err)
	}
	return id, nil
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
	return items, rows.Err()
}

// GetStringSliceFromJSONMap 从 JSONMap 提取字符串数组（store/service 共用，单一实现）。
func GetStringSliceFromJSONMap(m domain.JSONMap, key string) []string {
	raw, ok := m[key]
	if !ok || raw == nil {
		return nil
	}
	switch v := raw.(type) {
	case []string:
		return v
	case []any:
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

func getFloatMapFromJSONMap(m domain.JSONMap, key string) map[string]float64 {
	raw, ok := m[key]
	if !ok || raw == nil {
		return nil
	}
	switch v := raw.(type) {
	case map[string]float64:
		return v
	case map[string]any:
		out := make(map[string]float64, len(v))
		for k, x := range v {
			if f, ok := x.(float64); ok {
				out[k] = f
			}
		}
		return out
	}
	return nil
}

// CleanupTaskExamUsages 清理任务关联的考试安排（target_type='task'）及其独占的临时考试。
// 临时考试仅在其不再被任何安排引用时删除；正式试卷（is_temp=false）不受影响。
// 须在事务内调用（场景/任务删除共用）。
// 注意：不能合并为单条数据修改 CTE——CTE 的删除效果对同一语句的主查询不可见（快照语义），
// 会导致 NOT EXISTS 判定不到已删安排、临时考试永远残留。故拆为两条语句（同事务内后一条可见前一条效果）。
func CleanupTaskExamUsages(ctx context.Context, tx Queryer, taskID string) error {
	rows, err := tx.Query(ctx, `
		DELETE FROM exam_usages WHERE target_type = 'task' AND $1::uuid = ANY(target_ids) RETURNING exam_id
	`, taskID)
	if err != nil {
		return fmt.Errorf("cleanup task exam usages: %w", err)
	}
	var examIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return fmt.Errorf("scan deleted usage exam id: %w", err)
		}
		examIDs = append(examIDs, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("cleanup task exam usages: %w", err)
	}
	if len(examIDs) == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM exams e
		WHERE e.is_temp = TRUE
			AND e.id = ANY($1::uuid[])
			AND NOT EXISTS (SELECT 1 FROM exam_usages eu WHERE eu.exam_id = e.id)
	`, examIDs); err != nil {
		return fmt.Errorf("cleanup task temp exams: %w", err)
	}
	return nil
}

// ListEnabledMethodKeys 查询任务启用测评方式 key 列表（导出用）。
func (s *TaskEvaluationStore) ListEnabledMethodKeys(ctx context.Context, q Queryer, tenantID, taskID string) []string {
	rows, err := q.Query(ctx, `
		SELECT method_key FROM task_evaluation_methods
		WHERE task_id=$1 AND tenant_id=$2 AND is_enabled=true
		ORDER BY method_key
	`, taskID, tenantID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err == nil {
			out = append(out, k)
		}
	}
	return out
}
