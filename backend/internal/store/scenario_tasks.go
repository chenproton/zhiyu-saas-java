package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// TaskSelectColumns 任务查询列。
const TaskSelectColumns = `id, scenario_id, name, code, sort_order, description, detailed_description, description_pdf,
	estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced, source_scenario_id,
	knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id`

// ScenarioTaskStore 场景任务持久化。
type ScenarioTaskStore struct {
	q Queryer
}

// NewScenarioTaskStore 创建任务 store。
func NewScenarioTaskStore(q Queryer) *ScenarioTaskStore {
	return &ScenarioTaskStore{q: q}
}

// List 查询任务列表。
func (s *ScenarioTaskStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.ScenarioTask]) ([]domain.ScenarioTask, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanTaskRows)
}

// Get 查询单个任务。
func (s *ScenarioTaskStore) Get(ctx context.Context, id string) (*domain.ScenarioTask, error) {
	t, err := s.fetchTask(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

// TaskScenarioID 查询任务所属场景（租户归属校验用）。
func (s *ScenarioTaskStore) TaskScenarioID(ctx context.Context, taskID string) (string, error) {
	var scenarioID string
	err := s.q.QueryRow(ctx, `SELECT scenario_id FROM scenario_tasks WHERE id = $1`, taskID).Scan(&scenarioID)
	return scenarioID, err
}

// ScenarioTenantID 查询场景所属租户（归属校验用）。
func (s *ScenarioTaskStore) ScenarioTenantID(ctx context.Context, scenarioID string) (*string, error) {
	var tenantID *string
	err := s.q.QueryRow(ctx, `SELECT tenant_id FROM scenarios WHERE id = $1`, scenarioID).Scan(&tenantID)
	if err != nil {
		return nil, err
	}
	return tenantID, nil
}

// TaskTenantID 查询任务所属租户（归属校验用）。
func (s *ScenarioTaskStore) TaskTenantID(ctx context.Context, taskID string) (string, error) {
	var tenantID *string
	err := s.q.QueryRow(ctx, `SELECT tenant_id FROM scenario_tasks WHERE id = $1`, taskID).Scan(&tenantID)
	if err != nil {
		return "", err
	}
	if tenantID == nil {
		return "", nil
	}
	return *tenantID, nil
}

// Create 创建任务。
func (s *ScenarioTaskStore) Create(ctx context.Context, p *ScenarioTaskParams) (*domain.ScenarioTask, error) {
	var t domain.ScenarioTask
	err := s.q.QueryRow(ctx, `INSERT INTO scenario_tasks (`+TaskInsertColumns+`)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
		RETURNING `+TaskSelectColumns+`
	`, p.ScenarioID, p.Name, p.Code, p.SortOrder, p.Description, p.DetailedDescription, p.DescriptionPdf,
		p.EstimatedHours, p.TaskType, p.Difficulty, p.Background,
		p.DependencyIDs, p.IsReferenced, p.SourceScenarioID,
		p.KnowledgePointIDs, p.AbilityPointIDs, p.ResourceIDs, p.EvalData, p.TenantID).Scan(
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

// Update 更新任务（限定租户）。
func (s *ScenarioTaskStore) Update(ctx context.Context, id string, tenantID string, p *ScenarioTaskParams) (*domain.ScenarioTask, error) {
	tag, err := s.q.Exec(ctx, `
		UPDATE scenario_tasks SET scenario_id=$1, name=$2, code=$3, sort_order=$4,
			description=$5, detailed_description=$6, description_pdf=$7, estimated_hours=$8, task_type=$9,
			difficulty=$10, background=$11, dependency_ids=$12, is_referenced=$13,
			source_scenario_id=$14, knowledge_point_ids=$15, ability_point_ids=$16,
			resource_ids=$17, eval_data=$18
		WHERE id=$19 AND tenant_id=$20
	`, p.ScenarioID, p.Name, p.Code, p.SortOrder, p.Description, p.DetailedDescription, p.DescriptionPdf,
		p.EstimatedHours, p.TaskType, p.Difficulty, p.Background,
		p.DependencyIDs, p.IsReferenced, p.SourceScenarioID,
		p.KnowledgePointIDs, p.AbilityPointIDs, p.ResourceIDs, p.EvalData, id, tenantID)
	if err != nil {
		return nil, err
	}
	// 租户不匹配时 UPDATE 影响 0 行，直接按不存在处理，避免回读他租户任务
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.fetchTask(ctx, id)
}

// Delete 删除任务（限定租户）。
// 删除保护（文档 5.5）：存在该任务的场景测评成绩时拒绝物理删除。
func (s *ScenarioTaskStore) Delete(ctx context.Context, id string, tenantID string) error {
	var inUse bool
	if err := s.q.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM scene_evaluation_results WHERE task_id = $1)
	`, id).Scan(&inUse); err != nil {
		return err
	}
	if inUse {
		return ErrResourceInUse
	}
	_, err := s.q.Exec(ctx, `DELETE FROM scenario_tasks WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// Reorder 在事务内批量更新任务排序。
func (s *ScenarioTaskStore) Reorder(ctx context.Context, tx Queryer, scenarioID string, taskIDs []string) error {
	for i, taskID := range taskIDs {
		if _, err := tx.Exec(ctx, `
			UPDATE scenario_tasks SET sort_order = $1 WHERE id = $2 AND scenario_id = $3
		`, i, taskID, scenarioID); err != nil {
			return err
		}
	}
	return nil
}

// PopulateAbilityPointNames 为任务补充能力点名称，与 ability_point_ids 按序对齐。
// 避免前端依赖全量能力点列表接口（该接口 maxPageSize=200 会截断，导致引用旧能力点的任务预览缺失名称）。
func (s *ScenarioTaskStore) PopulateAbilityPointNames(ctx context.Context, items []domain.ScenarioTask) {
	if len(items) == 0 {
		return
	}
	idSet := make(map[string]struct{})
	for _, it := range items {
		for _, id := range it.AbilityPointIDs {
			if id != "" {
				idSet[id] = struct{}{}
			}
		}
	}
	if len(idSet) == 0 {
		return
	}
	ids := make([]string, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}
	nameByID := make(map[string]string, len(ids))
	rows, err := s.q.Query(ctx, `SELECT id, name FROM ability_points WHERE id = ANY($1)`, ids)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			continue
		}
		nameByID[id] = name
	}
	for i := range items {
		if len(items[i].AbilityPointIDs) == 0 {
			continue
		}
		names := make([]string, len(items[i].AbilityPointIDs))
		for j, id := range items[i].AbilityPointIDs {
			names[j] = nameByID[id]
		}
		items[i].AbilityPointNames = names
	}
}

// PopulateKnowledgePointNames 为任务补充知识点名称，与 knowledge_point_ids 按序对齐。
// 避免前端依赖全量知识点列表接口（该接口 maxPageSize=200 会截断，导致引用旧知识点的任务预览缺失名称）。
func (s *ScenarioTaskStore) PopulateKnowledgePointNames(ctx context.Context, items []domain.ScenarioTask) {
	if len(items) == 0 {
		return
	}
	idSet := make(map[string]struct{})
	for _, it := range items {
		for _, id := range it.KnowledgePointIDs {
			if id != "" {
				idSet[id] = struct{}{}
			}
		}
	}
	if len(idSet) == 0 {
		return
	}
	ids := make([]string, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}
	nameByID := make(map[string]string, len(ids))
	rows, err := s.q.Query(ctx, `SELECT id, name FROM knowledge_points WHERE id = ANY($1)`, ids)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			continue
		}
		nameByID[id] = name
	}
	for i := range items {
		if len(items[i].KnowledgePointIDs) == 0 {
			continue
		}
		names := make([]string, len(items[i].KnowledgePointIDs))
		for j, id := range items[i].KnowledgePointIDs {
			names[j] = nameByID[id]
		}
		items[i].KnowledgePointNames = names
	}
}

// PopulateEvalData 为任务补充已启用的评估方法摘要。
func (s *ScenarioTaskStore) PopulateEvalData(ctx context.Context, items []domain.ScenarioTask) {
	if len(items) == 0 {
		return
	}
	taskIDs := make([]string, len(items))
	for i, it := range items {
		taskIDs[i] = it.ID
	}
	rows, err := s.q.Query(ctx, `
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

// ScenarioTaskParams 任务创建/更新参数。
type ScenarioTaskParams struct {
	ScenarioID          string
	Name                string
	Code                string
	SortOrder           int
	Description         *string
	DetailedDescription *string
	DescriptionPdf      *string
	EstimatedHours      float64
	TaskType            string
	Difficulty          *int
	Background          *string
	DependencyIDs       []string
	IsReferenced        bool
	SourceScenarioID    *string
	KnowledgePointIDs   []string
	AbilityPointIDs     []string
	ResourceIDs         []string
	EvalData            []byte
	TenantID            *string
}

func (s *ScenarioTaskStore) fetchTask(ctx context.Context, id string) (*domain.ScenarioTask, error) {
	var t domain.ScenarioTask
	err := s.q.QueryRow(ctx, `SELECT `+TaskSelectColumns+` FROM scenario_tasks WHERE id = $1`, id).Scan(
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

// ListConfig 返回任务列表查询配置，SQL 片段沉淀在 store 层。
func (s *ScenarioTaskStore) ListConfig() ListQueryConfig[domain.ScenarioTask] {
	return ListQueryConfig[domain.ScenarioTask]{
		Table:         "scenario_tasks",
		SelectColumns: TaskSelectColumns,
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		OrderBy:       "sort_order",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if scenarioID := p.Values["scenarioId"]; scenarioID != "" {
				qb.AddCondition("scenario_id = " + qb.NextArg(scenarioID))
			}
		},
	}
}

func scanTaskRows(rows pgx.Rows) ([]domain.ScenarioTask, error) {
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
	return items, rows.Err()
}

// ScenarioTaskExportRow 导出用任务行。
type ScenarioTaskExportRow struct {
	ID                string
	Name              string
	TaskType          string
	Difficulty        int
	EstimatedHours    float64
	Background        string
	DetailedDesc      string
	KnowledgePointIDs []string
	AbilityPointIDs   []string
	ResourceIDs       []string
}

// ListByScenarioID 查询场景全部任务（导出用）。
func (s *ScenarioTaskStore) ListByScenarioID(ctx context.Context, q Queryer, tenantID, scenarioID string) ([]ScenarioTaskExportRow, error) {
	rows, err := q.Query(ctx, `
		SELECT id, name, task_type, difficulty, estimated_hours,
			COALESCE(background,''), COALESCE(detailed_description,''),
			knowledge_point_ids, ability_point_ids, resource_ids
		FROM scenario_tasks WHERE scenario_id=$1 AND tenant_id=$2 ORDER BY sort_order
	`, scenarioID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ScenarioTaskExportRow
	for rows.Next() {
		var r ScenarioTaskExportRow
		if err := rows.Scan(&r.ID, &r.Name, &r.TaskType, &r.Difficulty, &r.EstimatedHours, &r.Background, &r.DetailedDesc, &r.KnowledgePointIDs, &r.AbilityPointIDs, &r.ResourceIDs); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
