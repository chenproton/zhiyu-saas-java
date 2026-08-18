package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// ===== 场景导入/导出 store 方法（SQL 唯一所在地，handler 层不拼 SQL） =====
// 与 store/imports.go、store/alliance_brand_import.go 一致：方法接收 ctx + Queryer
// （*pgxpool.Pool / pgx.Tx 均满足），导入导出流程直接复用。

// LookupScenarioImport 按租户+名称查询场景（导入查重）：返回场景 ID、创建者、
// 共建者列表。未命中时返回 ("", "", nil, nil)。
func LookupScenarioImport(ctx context.Context, q Queryer, tenantID, name string) (id, creatorID string, builderIDs []string, err error) {
	err = q.QueryRow(ctx, `
		SELECT id, COALESCE(creator_id::text, '') AS creator_id, co_builder_ids
		FROM scenarios WHERE tenant_id=$1 AND name=$2 LIMIT 1
	`, tenantID, name).Scan(&id, &creatorID, &builderIDs)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil, nil
	}
	return id, creatorID, builderIDs, err
}

// UpdateScenarioImport 覆盖导入时更新场景基础字段（限定租户，WHERE id + tenant_id）。
func UpdateScenarioImport(ctx context.Context, q Queryer, scenarioID, tenantID, name string, careerPositionID *string, industryIDs, professionIDs []string, batchID *string, difficulty int, background *string) error {
	_, err := q.Exec(ctx, `
		UPDATE scenarios
		SET name=$3, career_position_id=$4, industry_ids=$5, profession_ids=$6,
		    batch_id=$7, difficulty=$8, background=$9
		WHERE id=$1 AND tenant_id=$2
	`, scenarioID, tenantID, name, careerPositionID, industryIDs, professionIDs,
		batchID, difficulty, background)
	return err
}

// ClearScenarioImportTasks 覆盖导入时清空场景原有任务及任务相关数据（先删测评方式再删任务，
// 两条删除独立执行，与历史 handler 行为一致）。
func ClearScenarioImportTasks(ctx context.Context, q Queryer, scenarioID string) error {
	_, err1 := q.Exec(ctx, `DELETE FROM task_evaluation_methods WHERE task_id IN (SELECT id FROM scenario_tasks WHERE scenario_id=$1)`, scenarioID)
	_, err2 := q.Exec(ctx, `DELETE FROM scenario_tasks WHERE scenario_id=$1`, scenarioID)
	if err1 != nil {
		return err1
	}
	return err2
}

// ScenarioImportNameTaken 判断场景名是否已被本租户占用（rename 模式生成不冲突名称用）。
func ScenarioImportNameTaken(ctx context.Context, q Queryer, tenantID, name string) bool {
	var id string
	_ = q.QueryRow(ctx, `SELECT id FROM scenarios WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	return id != ""
}

// CreateScenarioImport 导入创建场景（draft 状态，co_builder_ids 空数组）。
func CreateScenarioImport(ctx context.Context, q Queryer, scenarioID, tenantID, name, code string, careerPositionID *string, industryIDs, professionIDs []string, batchID *string, difficulty int, background *string, creatorID string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO scenarios (id, tenant_id, name, code, career_position_id, industry_ids, profession_ids,
			batch_id, difficulty, version, status, background, creator_id, co_builder_ids)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'V1.0','draft',$10,$11,'{}')
	`, scenarioID, tenantID, name, code, careerPositionID, industryIDs, professionIDs,
		batchID, difficulty, background, creatorID)
	return err
}

// CreateScenarioTaskImport 导入创建场景任务（eval_data/dependency_ids 空数组，非引用任务）。
func CreateScenarioTaskImport(ctx context.Context, q Queryer, taskID, tenantID, scenarioID, name, code string, sortOrder int, background, detailedDescription *string, estimatedHours float64, taskType string, difficulty int, knowledgePointIDs, abilityPointIDs, resourceIDs []string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO scenario_tasks (id, tenant_id, scenario_id, name, code, sort_order,
			background, detailed_description, estimated_hours, task_type, difficulty,
			knowledge_point_ids, ability_point_ids, resource_ids, eval_data, dependency_ids, is_referenced)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'{}','{}',false)
	`, taskID, tenantID, scenarioID, name, code, sortOrder,
		background, detailedDescription, estimatedHours, taskType, difficulty,
		knowledgePointIDs, abilityPointIDs, resourceIDs)
	return err
}

// UpsertScenarioTaskEvalMethodImport 导入写入/更新任务测评方式（等分权重，ON CONFLICT 更新）。
func UpsertScenarioTaskEvalMethodImport(ctx context.Context, q Queryer, methodID, tenantID, taskID, methodKey string, weight float64) error {
	_, err := q.Exec(ctx, `
		INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, eval_object, score_type, eval_subjects, rubric_template_id, resource_config, version, is_enabled)
		VALUES ($1,$2,$3,$4,$5,'individual',NULL,'[]'::jsonb,NULL,'{}'::jsonb,1,true)
		ON CONFLICT (task_id, method_key) DO UPDATE SET
			weight = EXCLUDED.weight,
			eval_object = EXCLUDED.eval_object,
			score_type = EXCLUDED.score_type,
			eval_subjects = EXCLUDED.eval_subjects,
			rubric_template_id = EXCLUDED.rubric_template_id,
			resource_config = EXCLUDED.resource_config,
			version = EXCLUDED.version,
			is_enabled = EXCLUDED.is_enabled
	`, methodID, tenantID, taskID, methodKey, weight)
	return err
}

// LookupCareerPositionIDByName 按租户+名称查找岗位 ID，未命中返回 nil。
func LookupCareerPositionIDByName(ctx context.Context, q Queryer, tenantID, name string) *string {
	if name == "" {
		return nil
	}
	var id string
	err := q.QueryRow(ctx, `SELECT id FROM career_positions WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
	if err != nil {
		return nil
	}
	return &id
}

// LookupIndustryIDsByNames 按租户+名称批量查找行业 ID，未命中忽略。
func LookupIndustryIDsByNames(ctx context.Context, q Queryer, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := make([]string, 0, len(names))
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := q.QueryRow(ctx, `SELECT id FROM industries WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

// LookupProfessionIDsByNames 按租户+名称（NFKC 归一化）批量查找专业 ID，未命中忽略。
func LookupProfessionIDsByNames(ctx context.Context, q Queryer, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := make([]string, 0, len(names))
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := q.QueryRow(ctx, `SELECT id FROM majors WHERE tenant_id=$1 AND normalize(name, NFKC)=normalize($2, NFKC) LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

// LookupAbilityPointIDsByNames 按租户+名称批量查找能力点 ID，未命中忽略。
func LookupAbilityPointIDsByNames(ctx context.Context, q Queryer, tenantID string, names []string) []string {
	if len(names) == 0 {
		return []string{}
	}
	ids := []string{}
	for _, name := range names {
		if name == "" {
			continue
		}
		var id string
		err := q.QueryRow(ctx, `SELECT id FROM ability_points WHERE tenant_id=$1 AND name=$2 LIMIT 1`, tenantID, name).Scan(&id)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

// LookupCareerPositionNameByID 按 id 查询岗位名称（导出用），未命中/出错返回空字符串与错误。
func LookupCareerPositionNameByID(ctx context.Context, q Queryer, id string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM career_positions WHERE id=$1`, id).Scan(&name)
	return name, err
}

// LookupSceneBatchNameByID 按 id 查询批次名称（导出用），未命中/出错返回空字符串与错误。
func LookupSceneBatchNameByID(ctx context.Context, q Queryer, id string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM scene_batches WHERE id=$1`, id).Scan(&name)
	return name, err
}

// LookupScenarioNameByID 按 id 查询场景名称（导出用），未命中/出错返回空字符串与错误。
func LookupScenarioNameByID(ctx context.Context, q Queryer, id string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM scenarios WHERE id=$1`, id).Scan(&name)
	return name, err
}

// scenarioExportNameTables 导出名称查询表白名单（沿用 query.go 白名单机制）。
var scenarioExportNameTables = []string{"industries", "majors"}

// LookupNamesByTable 按 id 批量查询表内名称（导出用），未命中的 id 忽略。
// 表名经 SanitizeIdentifier 白名单校验（保留原有动态表名校验方式），仅限 industries/majors。
func LookupNamesByTable(ctx context.Context, q Queryer, table string, ids []string) []string {
	table, err := SanitizeIdentifier(table, scenarioExportNameTables)
	if err != nil {
		return nil
	}
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		var name string
		if err := q.QueryRow(ctx, fmt.Sprintf(`SELECT name FROM %s WHERE id=$1`, table), id).Scan(&name); err == nil {
			names = append(names, name)
		}
	}
	return names
}

// LookupKnowledgePointNamesByIDs 按 id 批量查询知识点名称（导出用），查询失败/名称为空时忽略。
func LookupKnowledgePointNamesByIDs(ctx context.Context, q Queryer, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		var name string
		q.QueryRow(ctx, `SELECT name FROM knowledge_points WHERE id=$1`, id).Scan(&name)
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

// LookupAbilityPointNamesByIDs 按 id 批量查询能力点名称（导出用），查询失败/名称为空时忽略。
func LookupAbilityPointNamesByIDs(ctx context.Context, q Queryer, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		var name string
		q.QueryRow(ctx, `SELECT name FROM ability_points WHERE id=$1`, id).Scan(&name)
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

// LookupResourceNamesByIDs 按 id 批量查询资源库资源名称（导出用），查询失败/名称为空时忽略。
func LookupResourceNamesByIDs(ctx context.Context, q Queryer, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	var names []string
	for _, id := range ids {
		var name string
		q.QueryRow(ctx, `SELECT name FROM resource_library WHERE id=$1`, id).Scan(&name)
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}
