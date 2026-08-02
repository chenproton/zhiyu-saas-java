package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ScenarioWeightStore 场景任务权重配置持久化。
type ScenarioWeightStore struct {
	q Queryer
}

// NewScenarioWeightStore 创建权重 store。
func NewScenarioWeightStore(q Queryer) *ScenarioWeightStore {
	return &ScenarioWeightStore{q: q}
}

// List 查询权重配置列表。
func (s *ScenarioWeightStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.ScenarioWeightConfig]) ([]domain.ScenarioWeightConfig, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanScenarioWeightRows)
}

// Upsert 更新或创建权重配置（scenario_id+task_id 唯一冲突时更新权重）。
func (s *ScenarioWeightStore) Upsert(ctx context.Context, tenantID string, p *ScenarioWeightUpsertParams) (domain.ScenarioWeightConfig, error) {
	var id string
	if p.ID != "" {
		if _, err := s.q.Exec(ctx, `
			UPDATE scenario_weight_configs SET scenario_id = $1, task_id = $2, weight = $3 WHERE id = $4
		`, p.ScenarioID, p.TaskID, p.Weight, p.ID); err != nil {
			return domain.ScenarioWeightConfig{}, err
		}
		id = p.ID
	} else {
		err := s.q.QueryRow(ctx, `
			INSERT INTO scenario_weight_configs (tenant_id, scenario_id, task_id, weight)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (scenario_id, task_id) DO UPDATE SET weight = EXCLUDED.weight
			RETURNING id
		`, tenantID, p.ScenarioID, p.TaskID, p.Weight).Scan(&id)
		if err != nil {
			return domain.ScenarioWeightConfig{}, err
		}
	}
	var w domain.ScenarioWeightConfig
	err := s.q.QueryRow(ctx, `SELECT id, scenario_id, task_id, weight FROM scenario_weight_configs WHERE id = $1`, id).Scan(
		&w.ID, &w.ScenarioID, &w.TaskID, &w.Weight,
	)
	return w, err
}

// ListConfig 返回权重配置列表查询配置，SQL 片段沉淀在 store 层。
func (s *ScenarioWeightStore) ListConfig() ListQueryConfig[domain.ScenarioWeightConfig] {
	return ListQueryConfig[domain.ScenarioWeightConfig]{
		Table:         "scenario_weight_configs",
		SelectColumns: "id, scenario_id, task_id, weight",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if scenarioID := p.Values["scenarioId"]; scenarioID != "" {
				qb.AddCondition("scenario_id = " + qb.NextArg(scenarioID))
			}
			if taskID := p.Values["taskId"]; taskID != "" {
				qb.AddCondition("task_id = " + qb.NextArg(taskID))
			}
		},
	}
}

// ScenarioIDOf 查询权重配置所属场景（租户归属校验用）。
func (s *ScenarioWeightStore) ScenarioIDOf(ctx context.Context, id string) (string, error) {
	var scenarioID string
	err := s.q.QueryRow(ctx, `SELECT scenario_id FROM scenario_weight_configs WHERE id = $1`, id).Scan(&scenarioID)
	return scenarioID, err
}

// ScenarioWeightUpsertParams 权重 upsert 参数。
type ScenarioWeightUpsertParams struct {
	ID         string
	ScenarioID string
	TaskID     string
	Weight     float64
}

func scanScenarioWeightRows(rows pgx.Rows) ([]domain.ScenarioWeightConfig, error) {
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

// ScenarioGradeStore 场景等级映射持久化。
type ScenarioGradeStore struct {
	q Queryer
}

// NewScenarioGradeStore 创建等级映射 store。
func NewScenarioGradeStore(q Queryer) *ScenarioGradeStore {
	return &ScenarioGradeStore{q: q}
}

// List 查询等级映射列表。
func (s *ScenarioGradeStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.ScenarioGradeMapping]) ([]domain.ScenarioGradeMapping, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanScenarioGradeRows)
}

// Upsert 更新或创建等级映射。
func (s *ScenarioGradeStore) Upsert(ctx context.Context, tenantID string, p *ScenarioGradeUpsertParams) (domain.ScenarioGradeMapping, error) {
	var id string
	if p.ID != "" {
		if _, err := s.q.Exec(ctx, `
			UPDATE scenario_grade_mappings SET scenario_id = $1, task_id = $2, level = $3,
				min_score = $4, max_score = $5, description = $6, color = $7
			WHERE id = $8
		`, p.ScenarioID, p.TaskID, p.Level, p.MinScore, p.MaxScore, p.Description, p.Color, p.ID); err != nil {
			return domain.ScenarioGradeMapping{}, err
		}
		id = p.ID
	} else {
		err := s.q.QueryRow(ctx, `
			INSERT INTO scenario_grade_mappings (tenant_id, scenario_id, task_id, level, min_score, max_score, description, color)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id
		`, tenantID, p.ScenarioID, p.TaskID, p.Level, p.MinScore, p.MaxScore, p.Description, p.Color).Scan(&id)
		if err != nil {
			return domain.ScenarioGradeMapping{}, err
		}
	}
	var m domain.ScenarioGradeMapping
	err := s.q.QueryRow(ctx, `
		SELECT id, scenario_id, task_id, level, min_score, max_score, description, color
		FROM scenario_grade_mappings WHERE id = $1
	`, id).Scan(&m.ID, &m.ScenarioID, &m.TaskID, &m.Level, &m.MinScore, &m.MaxScore, &m.Description, &m.Color)
	return m, err
}

// ListConfig 返回等级映射列表查询配置，SQL 片段沉淀在 store 层。
func (s *ScenarioGradeStore) ListConfig() ListQueryConfig[domain.ScenarioGradeMapping] {
	return ListQueryConfig[domain.ScenarioGradeMapping]{
		Table:         "scenario_grade_mappings",
		SelectColumns: "id, scenario_id, task_id, level, min_score, max_score, description, color",
		TenantScoped:  true,
		OrderBy:       "min_score ASC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if scenarioID := p.Values["scenarioId"]; scenarioID != "" {
				qb.AddCondition("scenario_id = " + qb.NextArg(scenarioID))
			}
			if taskID := p.Values["taskId"]; taskID != "" {
				qb.AddCondition("task_id = " + qb.NextArg(taskID))
			}
		},
	}
}

// Delete 删除等级映射。
// ScenarioIDOf 查询等级映射所属场景（租户归属校验用）。
func (s *ScenarioGradeStore) ScenarioIDOf(ctx context.Context, id string) (string, error) {
	var scenarioID string
	err := s.q.QueryRow(ctx, `SELECT scenario_id FROM scenario_grade_mappings WHERE id = $1`, id).Scan(&scenarioID)
	return scenarioID, err
}

// ScenarioGradeUpsertParams 等级映射 upsert 参数。
type ScenarioGradeUpsertParams struct {
	ID          string
	ScenarioID  string
	TaskID      *string
	Level       string
	MinScore    float64
	MaxScore    float64
	Description *string
	Color       *string
}

func scanScenarioGradeRows(rows pgx.Rows) ([]domain.ScenarioGradeMapping, error) {
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

// TaskKnowledgeAbilityStore 任务知识/能力绑定持久化。
type TaskKnowledgeAbilityStore struct {
	q Queryer
}

// NewTaskKnowledgeAbilityStore 创建任务绑定 store。
func NewTaskKnowledgeAbilityStore(q Queryer) *TaskKnowledgeAbilityStore {
	return &TaskKnowledgeAbilityStore{q: q}
}

// BindKnowledge 绑定知识点到任务（唯一冲突时幂等）。
func (s *TaskKnowledgeAbilityStore) BindKnowledge(ctx context.Context, tenantID, taskID, knowledgePointID string) (domain.TaskKnowledgeBinding, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO task_knowledge_bindings (tenant_id, task_id, knowledge_point_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (task_id, knowledge_point_id) DO UPDATE SET task_id = EXCLUDED.task_id
		RETURNING id
	`, tenantID, taskID, knowledgePointID).Scan(&id)
	if err != nil {
		return domain.TaskKnowledgeBinding{}, err
	}
	var b domain.TaskKnowledgeBinding
	err = s.q.QueryRow(ctx, `SELECT id, task_id, knowledge_point_id FROM task_knowledge_bindings WHERE id = $1`, id).Scan(
		&b.ID, &b.TaskID, &b.KnowledgePointID,
	)
	return b, err
}

// TaskIDOf 查询绑定行关联的任务 ID（租户归属校验用）。
func (s *TaskKnowledgeAbilityStore) TaskIDOf(ctx context.Context, bindTable, id string) (string, error) {
	var taskID string
	err := s.q.QueryRow(ctx, `SELECT task_id FROM `+bindTable+` WHERE id = $1`, id).Scan(&taskID)
	return taskID, err
}

// UnbindKnowledge 解绑知识绑定。
func (s *TaskKnowledgeAbilityStore) UnbindKnowledge(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM task_knowledge_bindings WHERE id = $1`, id)
	return err
}

// BindAbility 绑定能力点到任务（唯一冲突时幂等）。
func (s *TaskKnowledgeAbilityStore) BindAbility(ctx context.Context, tenantID, taskID, abilityPointID string) (domain.TaskAbilityBinding, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO task_ability_bindings (tenant_id, task_id, ability_point_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (task_id, ability_point_id) DO UPDATE SET task_id = EXCLUDED.task_id
		RETURNING id
	`, tenantID, taskID, abilityPointID).Scan(&id)
	if err != nil {
		return domain.TaskAbilityBinding{}, err
	}
	var b domain.TaskAbilityBinding
	err = s.q.QueryRow(ctx, `SELECT id, task_id, ability_point_id FROM task_ability_bindings WHERE id = $1`, id).Scan(
		&b.ID, &b.TaskID, &b.AbilityPointID,
	)
	return b, err
}

// UnbindAbility 解绑能力绑定。
func (s *TaskKnowledgeAbilityStore) UnbindAbility(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM task_ability_bindings WHERE id = $1`, id)
	return err
}
