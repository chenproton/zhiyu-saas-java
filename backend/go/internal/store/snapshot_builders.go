package store

// 资源快照 builder：发布时把资源整树读取为 jsonb 存档（设计：docs/resource-snapshot-versioning.md 5.1）。
//
// snapshot_data 的 jsonb schema（按表名分 key；主表为对象，子表/连带表为行数组，
// 行内字段名 = 数据库列名，由 to_jsonb 直接生成）：
//
//   scenarios（BuildScenarioSnapshot）：
//     scenario                 对象：scenarios 主表内容列
//     scenario_tasks           数组：id + TaskInsertColumns（与克隆共用列常量）
//     task_evaluation_methods  数组：测评方法（含 resource_config / eval_subjects）
//     task_eval_points         数组：评分点（按 config_id 关联方法）
//     task_eval_score_rules    数组：评分规则
//     task_review_steps        数组：评审步骤
//     task_deliverables        数组：交付物
//     task_resource_bindings / task_knowledge_bindings / task_ability_bindings 数组：三张绑定表
//     scenario_weight_configs  数组：任务权重
//     scenario_grade_mappings  数组：等级映射
//     knowledge_points / ability_points / resource_library 数组：连带冻结的被引用实体内容
//     random_draw_questions    数组：resource_config.selectedQuestionIds 对应的抽题内容（文档 8.8）
//     position                 对象（可选）：关联岗位全树，结构同 BuildPositionSnapshot 输出
//
//   courses（BuildCourseSnapshot）：
//     course                   对象：courses 主表（CourseInsertColumns）
//     system_course_nodes      数组：节点（SystemCourseNodeInsertColumns，必含 eval_data，文档 13.D3）
//     node_quizzes / node_quiz_questions 数组：节点测验与题目（含答案字段，读取侧负责学生剥离）
//     hybrid_node_modules      数组：混合模块
//     course_knowledge_bindings / course_resource_bindings /
//     node_knowledge_point_bindings / node_resource_bindings 数组：绑定表
//     knowledge_points / resource_library 数组：连带冻结的被引用实体内容
//     granular_courses         对象（source_id → 颗粒课 bundle）：节点 ref_type='original' 引用的
//                              颗粒课一层（主表+节点+节点测验+混合模块，不递归，文档 12.3）
//
//   exams（BuildExamSnapshot）：
//     exam                     对象：exams 主表
//     exam_questions           数组：题目内容副本（含 answer/analysis，读取侧负责学生剥离）
//
//   question_banks（BuildQuestionBankSnapshot）：
//     question_bank            对象：question_banks 主表
//     questions                数组：已发布题目
//
//   career_positions（BuildPositionSnapshot）：
//     position                 对象：career_positions 主表（PositionInsertColumns）
//     career_position_majors   数组：专业绑定
//     position_responsibilities 数组：职责
//     position_ability_bindings  数组：能力绑定
//     ability_domains          数组：能力域
//     position_certificates    数组：证书绑定
//     certification_rules / certification_weights /
//     certification_ability_items / certification_ability_points 数组：认定规则链（clone 缺失，快照补齐）
//     ability_points           数组：连带冻结的能力点内容

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// snapshotBuilder 快照构建辅助：按 key 累积 jsonb 片段。
type snapshotBuilder struct {
	s     *SnapshotStore
	ctx   context.Context
	parts map[string]json.RawMessage
}

func newSnapshotBuilder(ctx context.Context, s *SnapshotStore) *snapshotBuilder {
	return &snapshotBuilder{s: s, ctx: ctx, parts: make(map[string]json.RawMessage)}
}

// putObj 查询单行 jsonb 对象放入 key；无行返回 ErrNotFound（主表必须存在且属于该租户）。
func (b *snapshotBuilder) putObj(key, sql string, args ...any) error {
	var raw []byte
	err := b.s.q.QueryRow(b.ctx, sql, args...).Scan(&raw)
	if err == pgx.ErrNoRows {
		return fmt.Errorf("%s: %w", key, ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("%s: %w", key, err)
	}
	b.parts[key] = json.RawMessage(raw)
	return nil
}

// putArr 查询多行 jsonb 数组放入 key（SQL 须用 COALESCE(jsonb_agg(...), '[]')，空结果为 []）。
func (b *snapshotBuilder) putArr(key, sql string, args ...any) error {
	var raw []byte
	if err := b.s.q.QueryRow(b.ctx, sql, args...).Scan(&raw); err != nil {
		return fmt.Errorf("%s: %w", key, err)
	}
	b.parts[key] = json.RawMessage(raw)
	return nil
}

// queryIDList 查询 id 列表（SQL 须返回单个 text[]，空结果为 {}）。
func (s *SnapshotStore) queryIDList(ctx context.Context, sql string, args ...any) ([]string, error) {
	var ids []string
	if err := s.q.QueryRow(ctx, sql, args...).Scan(&ids); err != nil {
		return nil, err
	}
	if ids == nil {
		ids = []string{}
	}
	return ids, nil
}

// marshalSnapshotDoc 把各 key 的 jsonb 片段组装为完整快照文档。
func marshalSnapshotDoc(parts map[string]json.RawMessage) (json.RawMessage, error) {
	data, err := json.Marshal(parts)
	if err != nil {
		return nil, fmt.Errorf("marshal snapshot: %w", err)
	}
	return data, nil
}

// BuildScenarioSnapshot 构建场景整树快照（含任务/测评配置/绑定/权重/连带引用/抽题/关联岗位树）。
func (s *SnapshotStore) BuildScenarioSnapshot(ctx context.Context, tenantID, scenarioID string) (json.RawMessage, error) {
	b := newSnapshotBuilder(ctx, s)

	if err := b.putObj("scenario", `
		SELECT to_jsonb(t) FROM (
			SELECT id, name, code, cover_image, career_position_id, industry_ids, profession_ids,
				batch_id, difficulty, version, background, delivery_goal, co_builder_ids
			FROM scenarios WHERE id = $1 AND tenant_id = $2
		) t
	`, scenarioID, tenantID); err != nil {
		return nil, err
	}

	taskIDsSub := `SELECT id FROM scenario_tasks WHERE scenario_id = $1`
	configIDsSub := `SELECT id FROM task_evaluation_methods WHERE tenant_id = $2 AND task_id IN (` + taskIDsSub + `)`

	if err := b.putArr("scenario_tasks", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, `+TaskInsertColumns+` FROM scenario_tasks WHERE scenario_id = $1 AND tenant_id = $2
		) t
	`, scenarioID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("task_evaluation_methods", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.task_id, t.method_key), '[]'::jsonb) FROM (
			SELECT id, task_id, method_key, weight, eval_object, score_type, eval_subjects,
				standard_name, standard_mode, resource_config, version, is_enabled
			FROM task_evaluation_methods WHERE tenant_id = $2 AND task_id IN (`+taskIDsSub+`)
		) t
	`, scenarioID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("task_eval_points", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, config_id, name, description, sub_type, types, weight, scoring_method,
				grade_mapping, knowledge_point_ids, ability_point_ids, sort_order
			FROM task_eval_points WHERE config_id IN (`+configIDsSub+`)
		) t
	`, scenarioID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("task_eval_score_rules", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, config_id, name, description, rule, weight, sort_order
			FROM task_eval_score_rules WHERE config_id IN (`+configIDsSub+`)
		) t
	`, scenarioID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("task_review_steps", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, config_id, label, description, enabled, subject_type, weight, sort_order
			FROM task_review_steps WHERE config_id IN (`+configIDsSub+`)
		) t
	`, scenarioID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("task_deliverables", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, task_id, type, name, description, evaluation_points, sort_order
			FROM task_deliverables WHERE task_id IN (`+taskIDsSub+`)
		) t
	`, scenarioID); err != nil {
		return nil, err
	}

	bindings := []struct{ key, table, col string }{
		{"task_resource_bindings", "task_resource_bindings", "resource_id"},
		{"task_knowledge_bindings", "task_knowledge_bindings", "knowledge_point_id"},
		{"task_ability_bindings", "task_ability_bindings", "ability_point_id"},
	}
	for _, bind := range bindings {
		if err := b.putArr(bind.key, `
			SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
				SELECT id, task_id, `+bind.col+` FROM `+bind.table+` WHERE task_id IN (`+taskIDsSub+`)
			) t
		`, scenarioID); err != nil {
			return nil, err
		}
	}

	if err := b.putArr("scenario_weight_configs", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, task_id, weight FROM scenario_weight_configs WHERE scenario_id = $1
		) t
	`, scenarioID); err != nil {
		return nil, err
	}
	if err := b.putArr("scenario_grade_mappings", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, task_id, level, min_score, max_score, description, color
			FROM scenario_grade_mappings WHERE scenario_id = $1
		) t
	`, scenarioID); err != nil {
		return nil, err
	}

	// 连带冻结：任务列/绑定表/评分点引用的知识点、能力点、资源库条目内容
	if err := s.putScenarioRefs(ctx, b.parts, tenantID, scenarioID, taskIDsSub, configIDsSub); err != nil {
		return nil, err
	}

	// 随机抽题连带（文档 8.8）：resource_config.selectedQuestionIds 对应的题目内容
	if err := s.putScenarioRandomDraw(ctx, b.parts, tenantID, scenarioID, taskIDsSub); err != nil {
		return nil, err
	}

	// 关联岗位树（职责/能力绑定/领域/证书/认定规则链），岗位可空
	var positionID *string
	if err := s.q.QueryRow(ctx, `
		SELECT career_position_id FROM scenarios WHERE id = $1 AND tenant_id = $2
	`, scenarioID, tenantID).Scan(&positionID); err != nil {
		return nil, fmt.Errorf("scenario snapshot position ref: %w", err)
	}
	if positionID != nil && *positionID != "" {
		posParts, err := s.buildPositionData(ctx, tenantID, *positionID)
		if err != nil {
			return nil, fmt.Errorf("scenario snapshot position: %w", err)
		}
		posDoc, err := marshalSnapshotDoc(posParts)
		if err != nil {
			return nil, err
		}
		b.parts["position"] = posDoc
	}

	return marshalSnapshotDoc(b.parts)
}

// putScenarioRefs 连带嵌入场景引用的知识点/能力点/资源库条目内容。
func (s *SnapshotStore) putScenarioRefs(ctx context.Context, parts map[string]json.RawMessage, tenantID, scenarioID, taskIDsSub, configIDsSub string) error {
	b := &snapshotBuilder{s: s, ctx: ctx, parts: parts}

	kpIDs, err := s.queryIDList(ctx, `
		SELECT COALESCE(array_agg(DISTINCT x)::text[], '{}'::text[]) FROM (
			SELECT unnest(st.knowledge_point_ids) AS x FROM scenario_tasks st WHERE st.scenario_id = $1
			UNION SELECT tkb.knowledge_point_id FROM task_knowledge_bindings tkb WHERE tkb.task_id IN (`+taskIDsSub+`)
			UNION SELECT unnest(tep.knowledge_point_ids) FROM task_eval_points tep WHERE tep.config_id IN (`+configIDsSub+`)
		) u
	`, scenarioID, tenantID)
	if err != nil {
		return fmt.Errorf("knowledge ids: %w", err)
	}
	if err := b.putArr("knowledge_points", knowledgePointsSQL, kpIDs, tenantID); err != nil {
		return err
	}

	apIDs, err := s.queryIDList(ctx, `
		SELECT COALESCE(array_agg(DISTINCT x)::text[], '{}'::text[]) FROM (
			SELECT unnest(st.ability_point_ids) AS x FROM scenario_tasks st WHERE st.scenario_id = $1
			UNION SELECT tab.ability_point_id FROM task_ability_bindings tab WHERE tab.task_id IN (`+taskIDsSub+`)
			UNION SELECT unnest(tep.ability_point_ids) FROM task_eval_points tep WHERE tep.config_id IN (`+configIDsSub+`)
		) u
	`, scenarioID, tenantID)
	if err != nil {
		return fmt.Errorf("ability ids: %w", err)
	}
	if err := b.putArr("ability_points", abilityPointsSQL, apIDs, tenantID); err != nil {
		return err
	}

	resIDs, err := s.queryIDList(ctx, `
		SELECT COALESCE(array_agg(DISTINCT x)::text[], '{}'::text[]) FROM (
			SELECT unnest(st.resource_ids) AS x FROM scenario_tasks st WHERE st.scenario_id = $1
			UNION SELECT trb.resource_id FROM task_resource_bindings trb WHERE trb.task_id IN (`+taskIDsSub+`)
		) u
	`, scenarioID)
	if err != nil {
		return fmt.Errorf("resource ids: %w", err)
	}
	if err := b.putArr("resource_library", resourceLibrarySQL, resIDs, tenantID); err != nil {
		return err
	}
	return nil
}

// putScenarioRandomDraw 连带嵌入 random_draw 测评方法 selectedQuestionIds 对应的抽题内容（文档 8.8）。
func (s *SnapshotStore) putScenarioRandomDraw(ctx context.Context, parts map[string]json.RawMessage, tenantID, scenarioID, taskIDsSub string) error {
	rows, err := s.q.Query(ctx, `
		SELECT resource_config FROM task_evaluation_methods
		WHERE tenant_id = $2 AND task_id IN (`+taskIDsSub+`)
	`, scenarioID, tenantID)
	if err != nil {
		return fmt.Errorf("random draw configs: %w", err)
	}
	defer rows.Close()
	idSet := make(map[string]bool)
	ids := []string{}
	for rows.Next() {
		var cfg []byte
		if err := rows.Scan(&cfg); err != nil {
			return fmt.Errorf("random draw configs: %w", err)
		}
		var parsed struct {
			SelectedQuestionIDs []string `json:"selectedQuestionIds"`
		}
		if len(cfg) == 0 || json.Unmarshal(cfg, &parsed) != nil {
			continue
		}
		for _, id := range parsed.SelectedQuestionIDs {
			if id != "" && !idSet[id] {
				idSet[id] = true
				ids = append(ids, id)
			}
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("random draw configs: %w", err)
	}
	b := &snapshotBuilder{s: s, ctx: ctx, parts: parts}
	return b.putArr("random_draw_questions", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, name, description, answer
			FROM random_draw_questions WHERE tenant_id = $2 AND id = ANY($1::uuid[])
		) t
	`, ids, tenantID)
}

// BuildCourseSnapshot 构建课程整树快照（含节点/测验/混合模块/绑定/连带引用/颗粒课一层）。
func (s *SnapshotStore) BuildCourseSnapshot(ctx context.Context, tenantID, courseID string) (json.RawMessage, error) {
	parts, err := s.buildCourseCore(ctx, tenantID, courseID)
	if err != nil {
		return nil, err
	}
	b := &snapshotBuilder{s: s, ctx: ctx, parts: parts}

	nodeIDsSub := `SELECT id FROM system_course_nodes WHERE course_id = $1 AND tenant_id = $2`

	if err := b.putArr("course_knowledge_bindings", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, course_id, knowledge_point_id, bind_type, source_id
			FROM course_knowledge_bindings WHERE course_id = $1
		) t
	`, courseID); err != nil {
		return nil, err
	}
	if err := b.putArr("course_resource_bindings", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, course_id, resource_id FROM course_resource_bindings WHERE course_id = $1 AND tenant_id = $2
		) t
	`, courseID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("node_knowledge_point_bindings", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, node_id, knowledge_point_id
			FROM node_knowledge_point_bindings WHERE node_id IN (`+nodeIDsSub+`)
		) t
	`, courseID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("node_resource_bindings", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, node_id, resource_id
			FROM node_resource_bindings WHERE node_id IN (`+nodeIDsSub+`)
		) t
	`, courseID, tenantID); err != nil {
		return nil, err
	}

	// 连带冻结：课程/节点列与绑定表引用的知识点、资源库条目内容
	kpIDs, err := s.queryIDList(ctx, `
		SELECT COALESCE(array_agg(DISTINCT x)::text[], '{}'::text[]) FROM (
			SELECT unnest(c.knowledge_point_ids) AS x FROM courses c WHERE c.id = $1
			UNION SELECT ckb.knowledge_point_id FROM course_knowledge_bindings ckb WHERE ckb.course_id = $1
			UNION SELECT unnest(n.knowledge_point_ids) FROM system_course_nodes n WHERE n.course_id = $1 AND n.tenant_id = $2
			UNION SELECT nkpb.knowledge_point_id FROM node_knowledge_point_bindings nkpb WHERE nkpb.node_id IN (`+nodeIDsSub+`)
		) u
	`, courseID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("course snapshot knowledge ids: %w", err)
	}
	if err := b.putArr("knowledge_points", knowledgePointsSQL, kpIDs, tenantID); err != nil {
		return nil, err
	}

	resIDs, err := s.queryIDList(ctx, `
		SELECT COALESCE(array_agg(DISTINCT x)::text[], '{}'::text[]) FROM (
			SELECT unnest(c.resource_ids) AS x FROM courses c WHERE c.id = $1
			UNION SELECT crb.resource_id FROM course_resource_bindings crb WHERE crb.course_id = $1 AND crb.tenant_id = $2
			UNION SELECT unnest(n.resource_ids) FROM system_course_nodes n WHERE n.course_id = $1 AND n.tenant_id = $2
			UNION SELECT nrb.resource_id FROM node_resource_bindings nrb WHERE nrb.node_id IN (`+nodeIDsSub+`)
		) u
	`, courseID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("course snapshot resource ids: %w", err)
	}
	if err := b.putArr("resource_library", resourceLibrarySQL, resIDs, tenantID); err != nil {
		return nil, err
	}

	// 颗粒课一层（文档 12.3）：节点 ref_type='original' 的 source_id 指向颗粒课 courses 行
	granularIDs, err := s.queryIDList(ctx, `
		SELECT COALESCE(array_agg(DISTINCT source_id)::text[], '{}'::text[])
		FROM system_course_nodes
		WHERE course_id = $1 AND tenant_id = $2 AND ref_type = 'original' AND source_id IS NOT NULL
	`, courseID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("course snapshot granular ids: %w", err)
	}
	granular := make(map[string]json.RawMessage, len(granularIDs))
	for _, gid := range granularIDs {
		entry, err := s.buildCourseCore(ctx, tenantID, gid)
		if err != nil {
			// 颗粒课被删/跨租户等异常不阻断主课快照（连带引用尽力而为）
			continue
		}
		entryJSON, err := marshalSnapshotDoc(entry)
		if err != nil {
			return nil, err
		}
		granular[gid] = entryJSON
	}
	granularJSON, err := json.Marshal(granular)
	if err != nil {
		return nil, fmt.Errorf("course snapshot granular_courses: %w", err)
	}
	parts["granular_courses"] = granularJSON

	return marshalSnapshotDoc(parts)
}

// buildCourseCore 构建课程核心内容（主表+节点+节点测验+混合模块），供课程快照与颗粒课一层复用。
func (s *SnapshotStore) buildCourseCore(ctx context.Context, tenantID, courseID string) (map[string]json.RawMessage, error) {
	b := newSnapshotBuilder(ctx, s)

	if err := b.putObj("course", `
		SELECT to_jsonb(t) FROM (
			SELECT `+CourseInsertColumns+` FROM courses WHERE id = $1 AND tenant_id = $2
		) t
	`, courseID, tenantID); err != nil {
		return nil, err
	}

	nodeIDsSub := `SELECT id FROM system_course_nodes WHERE course_id = $1 AND tenant_id = $2`

	if err := b.putArr("system_course_nodes", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT `+SystemCourseNodeInsertColumns+` FROM system_course_nodes WHERE course_id = $1 AND tenant_id = $2
		) t
	`, courseID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("node_quizzes", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, node_id, title, type, time_limit
			FROM node_quizzes WHERE node_id IN (`+nodeIDsSub+`)
		) t
	`, courseID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("node_quiz_questions", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, quiz_id, type, question, options, answer, score, sort_order
			FROM node_quiz_questions
			WHERE quiz_id IN (SELECT id FROM node_quizzes WHERE node_id IN (`+nodeIDsSub+`))
		) t
	`, courseID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("hybrid_node_modules", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, node_id, module_key, mode, data
			FROM hybrid_node_modules WHERE node_id IN (`+nodeIDsSub+`)
		) t
	`, courseID, tenantID); err != nil {
		return nil, err
	}
	return b.parts, nil
}

// BuildExamSnapshot 构建试卷快照（主表 + 题目内容副本）。
func (s *SnapshotStore) BuildExamSnapshot(ctx context.Context, tenantID, examID string) (json.RawMessage, error) {
	b := newSnapshotBuilder(ctx, s)

	if err := b.putObj("exam", `
		SELECT to_jsonb(t) FROM (
			SELECT id, code, name, description, status, total_score, duration, cover_image,
				is_temp, collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type
			FROM exams WHERE id = $1 AND tenant_id = $2
		) t
	`, examID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("exam_questions", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order
			FROM exam_questions WHERE exam_id = $1
		) t
	`, examID); err != nil {
		return nil, err
	}
	return marshalSnapshotDoc(b.parts)
}

// BuildQuestionBankSnapshot 构建题库快照（主表 + 已发布题目）。
func (s *SnapshotStore) BuildQuestionBankSnapshot(ctx context.Context, tenantID, bankID string) (json.RawMessage, error) {
	b := newSnapshotBuilder(ctx, s)

	if err := b.putObj("question_bank", `
		SELECT to_jsonb(t) FROM (
			SELECT id, code, name, description, cover_image, status, question_count,
				collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, is_draft_pool
			FROM question_banks WHERE id = $1 AND tenant_id = $2
		) t
	`, bankID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("questions", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at, t.id), '[]'::jsonb) FROM (
			SELECT id, code, bank_id, type, content, options, answer, analysis, score,
				difficulty, knowledge_point_ids, source, status, created_at
			FROM questions WHERE bank_id = $1 AND tenant_id = $2 AND status = 'published'
		) t
	`, bankID, tenantID); err != nil {
		return nil, err
	}
	return marshalSnapshotDoc(b.parts)
}

// BuildPositionSnapshot 构建岗位全树快照（职责/能力绑定/领域/证书 + 认定规则链 + 连带能力点）。
func (s *SnapshotStore) BuildPositionSnapshot(ctx context.Context, tenantID, positionID string) (json.RawMessage, error) {
	parts, err := s.buildPositionData(ctx, tenantID, positionID)
	if err != nil {
		return nil, err
	}
	return marshalSnapshotDoc(parts)
}

// buildPositionData 岗位快照内容（场景快照连带嵌入岗位时复用）。
func (s *SnapshotStore) buildPositionData(ctx context.Context, tenantID, positionID string) (map[string]json.RawMessage, error) {
	b := newSnapshotBuilder(ctx, s)

	if err := b.putObj("position", `
		SELECT to_jsonb(t) FROM (
			SELECT `+PositionInsertColumns+` FROM career_positions WHERE id = $1 AND tenant_id = $2
		) t
	`, positionID, tenantID); err != nil {
		return nil, err
	}
	if err := b.putArr("career_position_majors", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, career_position_id, major_id
			FROM career_position_majors WHERE career_position_id = $1
		) t
	`, positionID); err != nil {
		return nil, err
	}
	if err := b.putArr("position_responsibilities", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, career_position_id, name, description, sort_order
			FROM position_responsibilities WHERE career_position_id = $1
		) t
	`, positionID); err != nil {
		return nil, err
	}
	if err := b.putArr("position_ability_bindings", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, career_position_id, responsibility_id, ability_point_id, source,
				domain, required_level, rubric_description, attributes, weight
			FROM position_ability_bindings WHERE career_position_id = $1
		) t
	`, positionID); err != nil {
		return nil, err
	}
	if err := b.putArr("ability_domains", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, career_position_id, name, description, binding_ids, sort_order
			FROM ability_domains WHERE career_position_id = $1
		) t
	`, positionID); err != nil {
		return nil, err
	}
	if err := b.putArr("position_certificates", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, career_position_id, certificate_library_id
			FROM position_certificates WHERE career_position_id = $1
		) t
	`, positionID); err != nil {
		return nil, err
	}

	// 认定规则链（clone 缺失，快照补齐；表清单对齐 PositionStore.Delete 的清理路径）
	ruleIDsSub := `SELECT id FROM certification_rules WHERE career_position_id = $1`
	if err := b.putArr("certification_rules", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, career_position_id, status, rule_source, level_mapping
			FROM certification_rules WHERE career_position_id = $1
		) t
	`, positionID); err != nil {
		return nil, err
	}
	if err := b.putArr("certification_weights", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, rule_id, ability_point_id, task_id, weight
			FROM certification_weights WHERE rule_id IN (`+ruleIDsSub+`)
		) t
	`, positionID); err != nil {
		return nil, err
	}
	if err := b.putArr("certification_ability_items", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb) FROM (
			SELECT id, rule_id, name, sort_order
			FROM certification_ability_items WHERE rule_id IN (`+ruleIDsSub+`)
		) t
	`, positionID); err != nil {
		return nil, err
	}
	if err := b.putArr("certification_ability_points", `
		SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
			SELECT id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight
			FROM certification_ability_points
			WHERE item_id IN (SELECT id FROM certification_ability_items WHERE rule_id IN (`+ruleIDsSub+`))
		) t
	`, positionID); err != nil {
		return nil, err
	}

	// 连带冻结：能力绑定与认定规则引用的能力点内容
	apIDs, err := s.queryIDList(ctx, `
		SELECT COALESCE(array_agg(DISTINCT x)::text[], '{}'::text[]) FROM (
			SELECT pab.ability_point_id AS x FROM position_ability_bindings pab WHERE pab.career_position_id = $1
			UNION SELECT cap.ability_point_id FROM certification_ability_points cap
				WHERE cap.item_id IN (SELECT id FROM certification_ability_items WHERE rule_id IN (`+ruleIDsSub+`))
		) u
	`, positionID)
	if err != nil {
		return nil, fmt.Errorf("position snapshot ability ids: %w", err)
	}
	if err := b.putArr("ability_points", abilityPointsSQL, apIDs, tenantID); err != nil {
		return nil, err
	}
	return b.parts, nil
}

// 连带引用内容查询（参数固定为 ids text[] + tenant_id）。
const knowledgePointsSQL = `
	SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
		SELECT id, name, code, description, category
		FROM knowledge_points WHERE tenant_id = $2 AND id = ANY($1::uuid[])
	) t
`

// 能力点可跨租户共享（is_public），按 id 取并放宽租户条件。
const abilityPointsSQL = `
	SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
		SELECT id, name, code, description, attributes
		FROM ability_points WHERE (tenant_id = $2 OR is_public) AND id = ANY($1::uuid[])
	) t
`

const resourceLibrarySQL = `
	SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM (
		SELECT id, name, resource_type, url, description, thumbnail, file_size, metadata
		FROM resource_library WHERE tenant_id = $2 AND id = ANY($1::uuid[])
	) t
`
