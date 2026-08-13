package store

import (
	"context"
	"strings"

	"github.com/google/uuid"
)

// ===== 学校自建资源编辑（授权给企业后，企业复制 draft → 学校审批 → 覆盖原资源） =====

// CopyPositionAsDraft 复制岗位为授权编辑的 draft 副本（主表+子表，source_resource_id 关联原资源）。
func (s *PositionStore) CopyPositionAsDraft(ctx context.Context, tx Queryer, srcID, tenantID, enterpriseID, createdBy string) (string, error) {
	id := uuid.NewString()
	code := "ent-" + uuid.NewString()[:8]
	if _, err := tx.Exec(ctx, `
		INSERT INTO career_positions (
			id, tenant_id, code, batch_id, name, short_name, industry_id, position_type,
			salary_min, salary_max, cover_image, description, requirements, career_path,
			version, status, created_by, collaborators, source_type, source_enterprise_id, source_resource_id
		)
		SELECT $1, $2, $3, batch_id, name || '（编辑稿）', short_name, industry_id, position_type,
			salary_min, salary_max, cover_image, description, requirements, career_path,
			version, 'draft', $4, collaborators, 'enterprise', $5, $6
		FROM career_positions WHERE id = $7
	`, id, tenantID, code, createdBy, enterpriseID, srcID, srcID); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO career_position_majors (career_position_id, major_id)
		SELECT $1, major_id FROM career_position_majors WHERE career_position_id = $2
	`, id, srcID); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO position_ability_bindings (id, career_position_id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, attributes, weight, tenant_id)
		SELECT gen_random_uuid(), $1, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, attributes, weight, tenant_id
		FROM position_ability_bindings WHERE career_position_id = $2
	`, id, srcID); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO position_certificates (id, career_position_id, tenant_id, certificate_library_id)
		SELECT gen_random_uuid(), $1, tenant_id, certificate_library_id
		FROM position_certificates WHERE career_position_id = $2
	`, id, srcID); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO position_responsibilities (id, career_position_id, name, description, sort_order, tenant_id)
		SELECT gen_random_uuid(), $1, name, description, sort_order, tenant_id
		FROM position_responsibilities WHERE career_position_id = $2
	`, id, srcID); err != nil {
		return "", err
	}
	return id, nil
}

// MergePositionDraftToSource 审批通过后：用 draft 内容覆盖原资源并删除 draft（保留子表行 id 改挂原资源）。
func (s *PositionStore) MergePositionDraftToSource(ctx context.Context, tx Queryer, draftID, tenantID string) error {
	// 读 draft 最终 name（剥离「（编辑稿）」后缀），draft 临时改名后用于覆盖
	var draftName string
	var srcID *string
	if err := tx.QueryRow(ctx, `
		SELECT name, source_resource_id FROM career_positions WHERE id = $1 AND tenant_id = $2
	`, draftID, tenantID).Scan(&draftName, &srcID); err != nil {
		return err
	}
	finalName := strings.TrimSuffix(draftName, "（编辑稿）")
	if _, err := tx.Exec(ctx, `UPDATE career_positions SET name = name || '-' || id WHERE id = $1`, draftID); err != nil {
		return err
	}
	// 主表字段覆盖（code/batch_id/created_by 等归属字段保留原资源值）
	if _, err := tx.Exec(ctx, `
		UPDATE career_positions cp SET
			name = $3,
			short_name = d.short_name, industry_id = d.industry_id,
			position_type = d.position_type, salary_min = d.salary_min, salary_max = d.salary_max,
			cover_image = d.cover_image, description = d.description, requirements = d.requirements,
			career_path = d.career_path, version = d.version, collaborators = d.collaborators,
			status = 'published', updated_at = NOW()
		FROM career_positions d
		WHERE cp.id = d.source_resource_id AND d.id = $1 AND d.tenant_id = $2
	`, draftID, tenantID, finalName); err != nil {
		return err
	}
	for _, child := range []string{
		"career_position_majors", "position_ability_bindings", "position_certificates", "position_responsibilities",
	} {
		if _, err := tx.Exec(ctx, `
			DELETE FROM `+child+` WHERE career_position_id = (SELECT source_resource_id FROM career_positions WHERE id = $1)
		`, draftID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE `+child+` SET career_position_id = (SELECT source_resource_id FROM career_positions WHERE id = $1)
			WHERE career_position_id = $1
		`, draftID); err != nil {
			return err
		}
	}
	// 审批合并不走 Transition（文档 13.A4/5.5）：覆盖事务内补版本 bump + 写快照
	if srcID != nil && *srcID != "" {
		if err := NewSnapshotStore(tx).BumpVersionAndSnapshot(ctx, SnapshotResourcePosition, tenantID, *srcID); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `DELETE FROM career_positions WHERE id = $1 AND tenant_id = $2`, draftID, tenantID)
	return err
}

// CopyScenarioAsDraft 复制场景为授权编辑的 draft 副本（主表+任务子表，source_resource_id 关联原资源）。
func (s *ScenarioStore) CopyScenarioAsDraft(ctx context.Context, tx Queryer, srcID, tenantID, enterpriseID, createdBy string) (string, error) {
	id := uuid.NewString()
	code := "ent-" + uuid.NewString()[:8]
	if _, err := tx.Exec(ctx, `
		INSERT INTO scenarios (
			id, tenant_id, code, name, cover_image, career_position_id, industry_ids, profession_ids,
			batch_id, difficulty, version, status, background, delivery_goal, creator_id,
			co_builder_ids, source_type, source_enterprise_id, source_resource_id
		)
		SELECT $1, $2, $3, name || '（编辑稿）', cover_image, career_position_id, industry_ids, profession_ids,
			batch_id, difficulty, version, 'draft', background, delivery_goal, $4,
			co_builder_ids, 'enterprise', $5, $6
		FROM scenarios WHERE id = $7
	`, id, tenantID, code, createdBy, enterpriseID, srcID, srcID); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO scenario_tasks (
			id, scenario_id, name, code, sort_order, description, detailed_description,
			estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced,
			source_scenario_id, tenant_id, knowledge_point_ids, ability_point_ids, resource_ids, eval_data, description_pdf
		)
		SELECT gen_random_uuid(), $1, name, code, sort_order, description, detailed_description,
			estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced,
			source_scenario_id, tenant_id, knowledge_point_ids, ability_point_ids, resource_ids, eval_data, description_pdf
		FROM scenario_tasks WHERE scenario_id = $2
	`, id, srcID); err != nil {
		return "", err
	}
	return id, nil
}

// MergeScenarioDraftToSource 审批通过后：用 draft 内容覆盖原场景并删除 draft。
// 任务行保留 id 改挂原场景（task 子表引用不断裂）；原任务及其子表先删除。
func (s *ScenarioStore) MergeScenarioDraftToSource(ctx context.Context, tx Queryer, draftID, tenantID string) error {
	// 读 draft 最终 name（剥离「（编辑稿）」后缀）与源资源 id，draft 临时改名后用于覆盖
	var draftName string
	var srcIDVal *string
	if err := tx.QueryRow(ctx, `SELECT name, source_resource_id FROM scenarios WHERE id = $1 AND tenant_id = $2`, draftID, tenantID).Scan(&draftName, &srcIDVal); err != nil {
		return err
	}
	finalName := strings.TrimSuffix(draftName, "（编辑稿）")
	// draft 临时改名，避免覆盖时与原资源同名冲突
	if _, err := tx.Exec(ctx, `UPDATE scenarios SET name = name || '-' || id WHERE id = $1 AND tenant_id = $2`, draftID, tenantID); err != nil {
		return err
	}
	srcID := `(SELECT source_resource_id FROM scenarios WHERE id = $1)`
	// 原任务子表清理
	for _, child := range []string{"task_evaluation_methods", "task_knowledge_bindings", "task_resource_bindings", "scenario_weight_configs"} {
		if _, err := tx.Exec(ctx, `
			DELETE FROM `+child+` WHERE task_id IN (SELECT id FROM scenario_tasks WHERE scenario_id = `+srcID+`)
		`, draftID); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM scenario_tasks WHERE scenario_id = `+srcID, draftID); err != nil {
		return err
	}
	// 主表字段覆盖（code/batch_id/creator 等归属字段保留原资源值）
	if _, err := tx.Exec(ctx, `
		UPDATE scenarios sc SET
			name = $3,
			cover_image = d.cover_image, career_position_id = d.career_position_id,
			industry_ids = d.industry_ids, profession_ids = d.profession_ids,
			difficulty = d.difficulty, version = d.version, background = d.background,
			delivery_goal = d.delivery_goal, co_builder_ids = d.co_builder_ids,
			status = 'published', publish_time = NOW(), updated_at = NOW()
		FROM scenarios d
		WHERE sc.id = d.source_resource_id AND d.id = $1 AND d.tenant_id = $2
	`, draftID, tenantID, finalName); err != nil {
		return err
	}
	// draft 任务改挂原场景（保留 task id，子表引用不断裂）
	if _, err := tx.Exec(ctx, `
		UPDATE scenario_tasks SET scenario_id = (SELECT source_resource_id FROM scenarios WHERE id = $1)
		WHERE scenario_id = $1
	`, draftID); err != nil {
		return err
	}
	// 审批合并不走 Transition（文档 13.A4/5.5）：覆盖事务内补版本 bump + 写快照
	if srcIDVal != nil && *srcIDVal != "" {
		if err := NewSnapshotStore(tx).BumpVersionAndSnapshot(ctx, SnapshotResourceScenario, tenantID, *srcIDVal); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `DELETE FROM scenarios WHERE id = $1 AND tenant_id = $2`, draftID, tenantID)
	return err
}
