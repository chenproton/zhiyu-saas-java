package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneResourceSnapshot;

import java.util.List;

/**
 * 资源快照 Mapper（resource_snapshots 表 + 快照 builder SQL，Go→Java 迁移）。
 *
 * <p>快照 bundle 全部由 PG jsonb_agg/to_jsonb 生成（行内字段名 = 数据库列名），
 * Java 侧以 String 接收 jsonb 原文后组装为 Map，保证与 Go 输出形状完全一致。</p>
 *
 * @author zhiyu
 */
public interface SceneResourceSnapshotMapper extends BaseMapperPlus<SceneResourceSnapshot, SceneResourceSnapshot> {

    /** 快照资源类型 = 表名（对齐 Go SnapshotResource* 常量） */
    String TYPE_SCENARIO = "scenarios";

    /**
     * 按版本读取快照（无行返回 null；对齐 Go GetSnapshot）。
     */
    @Select("SELECT COALESCE(snapshot_data::text, '{}') FROM resource_snapshots"
        + " WHERE tenant_id = #{tenantId} AND resource_type = #{resourceType}"
        + " AND resource_id = #{resourceId} AND version = #{version}")
    String selectSnapshotData(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                              @Param("resourceId") String resourceId, @Param("version") String version);

    /**
     * 最新快照版本（按写入时间倒序；无快照返回 null，对齐 Go LatestVersion）。
     */
    @Select("SELECT version FROM resource_snapshots"
        + " WHERE tenant_id = #{tenantId} AND resource_type = #{resourceType} AND resource_id = #{resourceId}"
        + " ORDER BY created_at DESC, id DESC LIMIT 1")
    String selectLatestVersion(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                               @Param("resourceId") String resourceId);

    /**
     * 写入快照（(resource_type, resource_id, version) 幂等 upsert，对齐 Go SaveSnapshot）。
     */
    @Insert("INSERT INTO resource_snapshots (tenant_id, resource_type, resource_id, version, snapshot_data)"
        + " VALUES (#{tenantId}, #{resourceType}, #{resourceId}, #{version}, CAST(#{snapshotData} AS jsonb))"
        + " ON CONFLICT ON CONSTRAINT uq_resource_snapshots"
        + " DO UPDATE SET snapshot_data = EXCLUDED.snapshot_data, tenant_id = EXCLUDED.tenant_id")
    int saveSnapshot(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                     @Param("resourceId") String resourceId, @Param("version") String version,
                     @Param("snapshotData") String snapshotData);

    // ---------- 场景快照 builder（对齐 Go BuildScenarioSnapshot） ----------

    /** 任务 ID 子查询（快照 SQL 内嵌） */
    String TASK_IDS_SUB = "SELECT id FROM scenario_tasks WHERE scenario_id = #{scenarioId}";

    /** 测评方法配置 ID 子查询 */
    String CONFIG_IDS_SUB = "SELECT id FROM task_evaluation_methods WHERE tenant_id = #{tenantId}"
        + " AND task_id IN (" + TASK_IDS_SUB + ")";

    /** 场景主表对象（无行返回 null）。 */
    @Select("SELECT to_jsonb(t)::text FROM ("
        + " SELECT id, name, code, cover_image, career_position_id, industry_ids, profession_ids,"
        + " batch_id, difficulty, version, background, delivery_goal, co_builder_ids"
        + " FROM scenarios WHERE id = #{scenarioId} AND tenant_id = #{tenantId}) t")
    String buildScenarioObj(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 场景任务数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, scenario_id, name, code, sort_order, description, detailed_description, description_pdf,"
        + " estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced, source_scenario_id,"
        + " knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id"
        + " FROM scenario_tasks WHERE scenario_id = #{scenarioId} AND tenant_id = #{tenantId}) t")
    String buildScenarioTasks(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 测评方法数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.task_id, t.method_key), '[]'::jsonb)::text FROM ("
        + " SELECT id, task_id, method_key, weight, eval_object, score_type, eval_subjects,"
        + " standard_name, standard_mode, resource_config, version, is_enabled"
        + " FROM task_evaluation_methods WHERE tenant_id = #{tenantId} AND task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildEvalMethods(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 评估点数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, config_id, name, description, sub_type, types, weight, scoring_method,"
        + " grade_mapping, knowledge_point_ids, ability_point_ids, sort_order"
        + " FROM task_eval_points WHERE config_id IN (" + CONFIG_IDS_SUB + ")) t")
    String buildEvalPoints(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 评分规则数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, config_id, name, description, rule, weight, sort_order"
        + " FROM task_eval_score_rules WHERE config_id IN (" + CONFIG_IDS_SUB + ")) t")
    String buildScoreRules(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 评审步骤数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, config_id, label, description, enabled, subject_type, weight, sort_order"
        + " FROM task_review_steps WHERE config_id IN (" + CONFIG_IDS_SUB + ")) t")
    String buildReviewSteps(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 交付物数组（无租户条件）。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, task_id, type, name, description, evaluation_points, sort_order"
        + " FROM task_deliverables WHERE task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildDeliverables(@Param("scenarioId") String scenarioId);

    /** 资源绑定数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, task_id, resource_id FROM task_resource_bindings WHERE task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildResourceBindings(@Param("scenarioId") String scenarioId);

    /** 知识点绑定数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, task_id, knowledge_point_id FROM task_knowledge_bindings WHERE task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildKnowledgeBindings(@Param("scenarioId") String scenarioId);

    /** 能力点绑定数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, task_id, ability_point_id FROM task_ability_bindings WHERE task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildAbilityBindings(@Param("scenarioId") String scenarioId);

    /** 场景权重数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, task_id, weight FROM scenario_weight_configs WHERE scenario_id = #{scenarioId}) t")
    String buildWeightConfigs(@Param("scenarioId") String scenarioId);

    /** 等级映射数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, task_id, level, min_score, max_score, description, color"
        + " FROM scenario_grade_mappings WHERE scenario_id = #{scenarioId}) t")
    String buildGradeMappings(@Param("scenarioId") String scenarioId);

    /** 连带引用的知识点 ID 列表（json 数组文本）。 */
    @Select("SELECT COALESCE(array_to_json(array_agg(DISTINCT x))::text, '[]') FROM ("
        + " SELECT unnest(st.knowledge_point_ids)::text AS x FROM scenario_tasks st WHERE st.scenario_id = #{scenarioId}"
        + " UNION SELECT tkb.knowledge_point_id::text FROM task_knowledge_bindings tkb WHERE tkb.task_id IN (" + TASK_IDS_SUB + ")"
        + " UNION SELECT unnest(tep.knowledge_point_ids)::text FROM task_eval_points tep WHERE tep.config_id IN (" + CONFIG_IDS_SUB + ")) u")
    String collectKnowledgePointIds(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 连带引用的能力点 ID 列表（json 数组文本）。 */
    @Select("SELECT COALESCE(array_to_json(array_agg(DISTINCT x))::text, '[]') FROM ("
        + " SELECT unnest(st.ability_point_ids)::text AS x FROM scenario_tasks st WHERE st.scenario_id = #{scenarioId}"
        + " UNION SELECT tab.ability_point_id::text FROM task_ability_bindings tab WHERE tab.task_id IN (" + TASK_IDS_SUB + ")"
        + " UNION SELECT unnest(tep.ability_point_ids)::text FROM task_eval_points tep WHERE tep.config_id IN (" + CONFIG_IDS_SUB + ")) u")
    String collectAbilityPointIds(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 连带引用的资源 ID 列表（json 数组文本）。 */
    @Select("SELECT COALESCE(array_to_json(array_agg(DISTINCT x))::text, '[]') FROM ("
        + " SELECT unnest(st.resource_ids)::text AS x FROM scenario_tasks st WHERE st.scenario_id = #{scenarioId}"
        + " UNION SELECT trb.resource_id::text FROM task_resource_bindings trb WHERE trb.task_id IN (" + TASK_IDS_SUB + ")) u")
    String collectResourceIds(@Param("scenarioId") String scenarioId);

    /** 知识点内容数组（连带冻结）。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, name, code, description, category FROM knowledge_points"
        + " WHERE tenant_id = #{tenantId} AND id = ANY("
        + " CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]))) t")
    String buildKnowledgePoints(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);

    /** 能力点内容数组（连带冻结；is_public 可跨租户）。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, name, code, description, attributes FROM ability_points"
        + " WHERE (tenant_id = #{tenantId} OR is_public) AND id = ANY("
        + " CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]))) t")
    String buildAbilityPoints(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);

    /** 资源库条目数组（连带冻结）。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, name, resource_type, url, description, thumbnail, file_size, metadata FROM resource_library"
        + " WHERE tenant_id = #{tenantId} AND id = ANY("
        + " CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]))) t")
    String buildResourceLibrary(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);

    /** 随机抽题题目数组（连带冻结；answer 学生侧剥离）。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, name, description, answer FROM random_draw_questions"
        + " WHERE tenant_id = #{tenantId} AND id = ANY("
        + " CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]))) t")
    String buildRandomDrawQuestions(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);

    /** 场景关联岗位 ID（可为 null）。 */
    @Select("SELECT career_position_id FROM scenarios WHERE id = #{scenarioId} AND tenant_id = #{tenantId}")
    String selectCareerPositionId(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /**
     * 任务测评方法的 resource_config 列表（快照抽题收集用；对齐 Go putScenarioRandomDraw 第一步）。
     */
    @Select("SELECT COALESCE(resource_config::text, '{}') FROM task_evaluation_methods"
        + " WHERE tenant_id = #{tenantId} AND task_id IN"
        + " (SELECT id FROM scenario_tasks WHERE scenario_id = #{scenarioId})")
    List<String> selectResourceConfigs(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    // ---------- 岗位快照 builder（场景快照连带嵌入岗位全树） ----------

    /** 岗位主表对象。 */
    @Select("SELECT to_jsonb(t)::text FROM ("
        + " SELECT id, tenant_id, code, batch_id, name, short_name, industry_id, position_type,"
        + " salary_min, salary_max, cover_image, description, requirements, career_path,"
        + " version, status, created_by, collaborators"
        + " FROM career_positions WHERE id = #{positionId} AND tenant_id = #{tenantId}) t")
    String buildPositionObj(@Param("positionId") String positionId, @Param("tenantId") String tenantId);

    /** 岗位-专业绑定数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id, major_id FROM career_position_majors WHERE career_position_id = #{positionId}) t")
    String buildPositionMajors(@Param("positionId") String positionId);

    /** 岗位职责数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id, name, description, sort_order"
        + " FROM position_responsibilities WHERE career_position_id = #{positionId}) t")
    String buildPositionResponsibilities(@Param("positionId") String positionId);

    /** 岗位能力绑定数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id, responsibility_id, ability_point_id, source,"
        + " domain, required_level, rubric_description, attributes, weight"
        + " FROM position_ability_bindings WHERE career_position_id = #{positionId}) t")
    String buildPositionAbilityBindings(@Param("positionId") String positionId);

    /** 能力域数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id, name, description, binding_ids, sort_order"
        + " FROM ability_domains WHERE career_position_id = #{positionId}) t")
    String buildAbilityDomains(@Param("positionId") String positionId);

    /** 岗位证书数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id, certificate_library_id"
        + " FROM position_certificates WHERE career_position_id = #{positionId}) t")
    String buildPositionCertificates(@Param("positionId") String positionId);

    /** 认定规则数组（规则 ID 子查询：certification_rules）。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id, status, rule_source, level_mapping"
        + " FROM certification_rules WHERE career_position_id = #{positionId}) t")
    String buildCertificationRules(@Param("positionId") String positionId);

    /** 认定权重数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, rule_id, ability_point_id, task_id, weight FROM certification_weights"
        + " WHERE rule_id IN (SELECT id FROM certification_rules WHERE career_position_id = #{positionId})) t")
    String buildCertificationWeights(@Param("positionId") String positionId);

    /** 认定能力条目数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, rule_id, name, sort_order FROM certification_ability_items"
        + " WHERE rule_id IN (SELECT id FROM certification_rules WHERE career_position_id = #{positionId})) t")
    String buildCertificationAbilityItems(@Param("positionId") String positionId);

    /** 认定能力点数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight"
        + " FROM certification_ability_points"
        + " WHERE item_id IN (SELECT id FROM certification_ability_items"
        + " WHERE rule_id IN (SELECT id FROM certification_rules WHERE career_position_id = #{positionId}))) t")
    String buildCertificationAbilityPoints(@Param("positionId") String positionId);

    /** 岗位连带引用的能力点 ID 列表（json 数组文本）。 */
    @Select("SELECT COALESCE(array_to_json(array_agg(DISTINCT x))::text, '[]') FROM ("
        + " SELECT pab.ability_point_id::text AS x FROM position_ability_bindings pab WHERE pab.career_position_id = #{positionId}"
        + " UNION SELECT cap.ability_point_id::text FROM certification_ability_points cap"
        + " WHERE cap.item_id IN (SELECT id FROM certification_ability_items"
        + " WHERE rule_id IN (SELECT id FROM certification_rules WHERE career_position_id = #{positionId}))) u")
    String collectPositionAbilityPointIds(@Param("positionId") String positionId);
}
