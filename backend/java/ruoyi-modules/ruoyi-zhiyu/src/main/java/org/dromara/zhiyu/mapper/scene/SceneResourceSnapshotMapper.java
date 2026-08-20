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
 * <p>快照 bundle 全部由 MySQL JSON_OBJECT/JSON_ARRAYAGG 生成（行内字段名 = 数据库列名），
 * Java 侧以 String 接收 JSON 原文后组装为 Map，保证与 Go 输出形状完全一致。
 * MySQL 版：原 PG to_jsonb/jsonb_agg/unnest 改 JSON_OBJECT / JSON_ARRAYAGG / JSON_TABLE。</p>
 *
 * @author zhiyu
 */
public interface SceneResourceSnapshotMapper extends BaseMapperPlus<SceneResourceSnapshot, SceneResourceSnapshot> {

    /** 快照资源类型 = 表名（对齐 Go SnapshotResource* 常量） */
    String TYPE_SCENARIO = "scenarios";

    /**
     * 按版本读取快照（无行返回 null；对齐 Go GetSnapshot）。
     */
    @Select("SELECT COALESCE(CAST(snapshot_data AS CHAR), '{}') FROM resource_snapshots"
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
        + " VALUES (#{tenantId}, #{resourceType}, #{resourceId}, #{version}, CAST(#{snapshotData} AS JSON))"
        + " ON DUPLICATE KEY UPDATE snapshot_data = VALUES(snapshot_data), tenant_id = VALUES(tenant_id)")
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
    @Select("SELECT JSON_OBJECT("
        + " 'id', t.id, 'name', t.name, 'code', t.code, 'cover_image', t.cover_image,"
        + " 'career_position_id', t.career_position_id, 'industry_ids', t.industry_ids, 'profession_ids', t.profession_ids,"
        + " 'batch_id', t.batch_id, 'difficulty', t.difficulty, 'version', t.version,"
        + " 'background', t.background, 'delivery_goal', t.delivery_goal, 'co_builder_ids', t.co_builder_ids"
        + ") FROM (SELECT id, name, code, cover_image, career_position_id, industry_ids, profession_ids,"
        + " batch_id, difficulty, version, background, delivery_goal, co_builder_ids"
        + " FROM scenarios WHERE id = #{scenarioId} AND tenant_id = #{tenantId}) t")
    String buildScenarioObj(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 场景任务数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'scenario_id', t.scenario_id, 'name', t.name, 'code', t.code, 'sort_order', t.sort_order,"
        + " 'description', t.description, 'detailed_description', t.detailed_description, 'description_pdf', t.description_pdf,"
        + " 'estimated_hours', t.estimated_hours, 'task_type', t.task_type, 'difficulty', t.difficulty,"
        + " 'background', t.background, 'dependency_ids', t.dependency_ids, 'is_referenced', t.is_referenced,"
        + " 'source_scenario_id', t.source_scenario_id, 'knowledge_point_ids', t.knowledge_point_ids,"
        + " 'ability_point_ids', t.ability_point_ids, 'resource_ids', t.resource_ids, 'eval_data', t.eval_data,"
        + " 'tenant_id', t.tenant_id"
        + ") ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, scenario_id, name, code, sort_order, description,"
        + " detailed_description, description_pdf, estimated_hours, task_type, difficulty, background, dependency_ids,"
        + " is_referenced, source_scenario_id, knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id"
        + " FROM scenario_tasks WHERE scenario_id = #{scenarioId} AND tenant_id = #{tenantId}) t")
    String buildScenarioTasks(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 测评方法数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'task_id', t.task_id, 'method_key', t.method_key, 'weight', t.weight,"
        + " 'eval_object', t.eval_object, 'score_type', t.score_type, 'eval_subjects', t.eval_subjects,"
        + " 'standard_name', t.standard_name, 'standard_mode', t.standard_mode, 'resource_config', t.resource_config,"
        + " 'version', t.version, 'is_enabled', t.is_enabled"
        + ") ORDER BY t.task_id, t.method_key), '[]') FROM (SELECT id, task_id, method_key, weight, eval_object,"
        + " score_type, eval_subjects, standard_name, standard_mode, resource_config, version, is_enabled"
        + " FROM task_evaluation_methods WHERE tenant_id = #{tenantId} AND task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildEvalMethods(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 评估点数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'config_id', t.config_id, 'name', t.name, 'description', t.description,"
        + " 'sub_type', t.sub_type, 'types', t.types, 'weight', t.weight, 'scoring_method', t.scoring_method,"
        + " 'grade_mapping', t.grade_mapping, 'knowledge_point_ids', t.knowledge_point_ids,"
        + " 'ability_point_ids', t.ability_point_ids, 'sort_order', t.sort_order"
        + ") ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, config_id, name, description, sub_type, types, weight,"
        + " scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order"
        + " FROM task_eval_points WHERE config_id IN (" + CONFIG_IDS_SUB + ")) t")
    String buildEvalPoints(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 评分规则数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'config_id', t.config_id, 'name', t.name, 'description', t.description,"
        + " 'rule', t.rule, 'weight', t.weight, 'sort_order', t.sort_order"
        + ") ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, config_id, name, description, rule, weight, sort_order"
        + " FROM task_eval_score_rules WHERE config_id IN (" + CONFIG_IDS_SUB + ")) t")
    String buildScoreRules(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 评审步骤数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'config_id', t.config_id, 'label', t.label, 'description', t.description,"
        + " 'enabled', t.enabled, 'subject_type', t.subject_type, 'weight', t.weight, 'sort_order', t.sort_order"
        + ") ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, config_id, label, description, enabled,"
        + " subject_type, weight, sort_order FROM task_review_steps WHERE config_id IN (" + CONFIG_IDS_SUB + ")) t")
    String buildReviewSteps(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 交付物数组（无租户条件）。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'task_id', t.task_id, 'type', t.type, 'name', t.name, 'description', t.description,"
        + " 'evaluation_points', t.evaluation_points, 'sort_order', t.sort_order"
        + ") ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, task_id, type, name, description, evaluation_points, sort_order"
        + " FROM task_deliverables WHERE task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildDeliverables(@Param("scenarioId") String scenarioId);

    /** 资源绑定数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'task_id', t.task_id, 'resource_id', t.resource_id"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, task_id, resource_id FROM task_resource_bindings"
        + " WHERE task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildResourceBindings(@Param("scenarioId") String scenarioId);

    /** 知识点绑定数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'task_id', t.task_id, 'knowledge_point_id', t.knowledge_point_id"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, task_id, knowledge_point_id FROM task_knowledge_bindings"
        + " WHERE task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildKnowledgeBindings(@Param("scenarioId") String scenarioId);

    /** 能力点绑定数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'task_id', t.task_id, 'ability_point_id', t.ability_point_id"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, task_id, ability_point_id FROM task_ability_bindings"
        + " WHERE task_id IN (" + TASK_IDS_SUB + ")) t")
    String buildAbilityBindings(@Param("scenarioId") String scenarioId);

    /** 场景权重数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'task_id', t.task_id, 'weight', t.weight"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, task_id, weight FROM scenario_weight_configs"
        + " WHERE scenario_id = #{scenarioId}) t")
    String buildWeightConfigs(@Param("scenarioId") String scenarioId);

    /** 等级映射数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'task_id', t.task_id, 'level', t.level, 'min_score', t.min_score,"
        + " 'max_score', t.max_score, 'description', t.description, 'color', t.color"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, task_id, level, min_score, max_score, description, color"
        + " FROM scenario_grade_mappings WHERE scenario_id = #{scenarioId}) t")
    String buildGradeMappings(@Param("scenarioId") String scenarioId);

    /** 连带引用的知识点 ID 列表（JSON 数组文本）。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(x), JSON_ARRAY()) FROM (SELECT DISTINCT x FROM ("
        + " SELECT jt.x AS x FROM scenario_tasks st JOIN JSON_TABLE(st.knowledge_point_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + "   WHERE st.scenario_id = #{scenarioId}"
        + " UNION SELECT tkb.knowledge_point_id AS x FROM task_knowledge_bindings tkb WHERE tkb.task_id IN (" + TASK_IDS_SUB + ")"
        + " UNION SELECT jt.x AS x FROM task_eval_points tep JOIN JSON_TABLE(tep.knowledge_point_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + "   WHERE tep.config_id IN (" + CONFIG_IDS_SUB + ")) u) v")
    String collectKnowledgePointIds(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 连带引用的能力点 ID 列表（JSON 数组文本）。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(x), JSON_ARRAY()) FROM (SELECT DISTINCT x FROM ("
        + " SELECT jt.x AS x FROM scenario_tasks st JOIN JSON_TABLE(st.ability_point_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + "   WHERE st.scenario_id = #{scenarioId}"
        + " UNION SELECT tab.ability_point_id AS x FROM task_ability_bindings tab WHERE tab.task_id IN (" + TASK_IDS_SUB + ")"
        + " UNION SELECT jt.x AS x FROM task_eval_points tep JOIN JSON_TABLE(tep.ability_point_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + "   WHERE tep.config_id IN (" + CONFIG_IDS_SUB + ")) u) v")
    String collectAbilityPointIds(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /** 连带引用的资源 ID 列表（JSON 数组文本）。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(x), JSON_ARRAY()) FROM (SELECT DISTINCT x FROM ("
        + " SELECT jt.x AS x FROM scenario_tasks st JOIN JSON_TABLE(st.resource_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + "   WHERE st.scenario_id = #{scenarioId}"
        + " UNION SELECT trb.resource_id AS x FROM task_resource_bindings trb WHERE trb.task_id IN (" + TASK_IDS_SUB + ")) u) v")
    String collectResourceIds(@Param("scenarioId") String scenarioId);

    /** 知识点内容数组（连带冻结）。 */
    @Select("<script>SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'name', t.name, 'code', t.code, 'description', t.description, 'category', t.category"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, name, code, description, category FROM knowledge_points"
        + " WHERE tenant_id = #{tenantId} AND id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>) t</script>")
    String buildKnowledgePoints(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);

    /** 能力点内容数组（连带冻结；is_public 可跨租户）。 */
    @Select("<script>SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'name', t.name, 'code', t.code, 'description', t.description, 'attributes', t.attributes"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, name, code, description, attributes FROM ability_points"
        + " WHERE (tenant_id = #{tenantId} OR is_public) AND id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>) t</script>")
    String buildAbilityPoints(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);

    /** 资源库条目数组（连带冻结）。 */
    @Select("<script>SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'name', t.name, 'resource_type', t.resource_type, 'url', t.url, 'description', t.description,"
        + " 'thumbnail', t.thumbnail, 'file_size', t.file_size, 'metadata', t.metadata"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, name, resource_type, url, description, thumbnail, file_size, metadata"
        + " FROM resource_library WHERE tenant_id = #{tenantId} AND id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>) t</script>")
    String buildResourceLibrary(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);

    /** 随机抽题题目数组（连带冻结；answer 学生侧剥离）。 */
    @Select("<script>SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'name', t.name, 'description', t.description, 'answer', t.answer"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, name, description, answer FROM random_draw_questions"
        + " WHERE tenant_id = #{tenantId} AND id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>) t</script>")
    String buildRandomDrawQuestions(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);

    /** 场景关联岗位 ID（可为 null）。 */
    @Select("SELECT career_position_id FROM scenarios WHERE id = #{scenarioId} AND tenant_id = #{tenantId}")
    String selectCareerPositionId(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    /**
     * 任务测评方法的 resource_config 列表（快照抽题收集用；对齐 Go putScenarioRandomDraw 第一步）。
     */
    @Select("SELECT COALESCE(CAST(resource_config AS CHAR), '{}') FROM task_evaluation_methods"
        + " WHERE tenant_id = #{tenantId} AND task_id IN"
        + " (SELECT id FROM scenario_tasks WHERE scenario_id = #{scenarioId})")
    List<String> selectResourceConfigs(@Param("scenarioId") String scenarioId, @Param("tenantId") String tenantId);

    // ---------- 岗位快照 builder（场景快照连带嵌入岗位全树） ----------

    /** 岗位主表对象。 */
    @Select("SELECT JSON_OBJECT("
        + " 'id', t.id, 'tenant_id', t.tenant_id, 'code', t.code, 'batch_id', t.batch_id, 'name', t.name,"
        + " 'short_name', t.short_name, 'industry_id', t.industry_id, 'position_type', t.position_type,"
        + " 'salary_min', t.salary_min, 'salary_max', t.salary_max, 'cover_image', t.cover_image,"
        + " 'description', t.description, 'requirements', t.requirements, 'career_path', t.career_path,"
        + " 'version', t.version, 'status', t.status, 'created_by', t.created_by, 'collaborators', t.collaborators"
        + ") FROM (SELECT id, tenant_id, code, batch_id, name, short_name, industry_id, position_type,"
        + " salary_min, salary_max, cover_image, description, requirements, career_path,"
        + " version, status, created_by, collaborators"
        + " FROM career_positions WHERE id = #{positionId} AND tenant_id = #{tenantId}) t")
    String buildPositionObj(@Param("positionId") String positionId, @Param("tenantId") String tenantId);

    /** 岗位-专业绑定数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'career_position_id', t.career_position_id, 'major_id', t.major_id"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, career_position_id, major_id FROM career_position_majors"
        + " WHERE career_position_id = #{positionId}) t")
    String buildPositionMajors(@Param("positionId") String positionId);

    /** 岗位职责数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'career_position_id', t.career_position_id, 'name', t.name, 'description', t.description,"
        + " 'sort_order', t.sort_order"
        + ") ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, career_position_id, name, description, sort_order"
        + " FROM position_responsibilities WHERE career_position_id = #{positionId}) t")
    String buildPositionResponsibilities(@Param("positionId") String positionId);

    /** 岗位能力绑定数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'career_position_id', t.career_position_id, 'responsibility_id', t.responsibility_id,"
        + " 'ability_point_id', t.ability_point_id, 'source', t.source, 'domain', t.domain,"
        + " 'required_level', t.required_level, 'rubric_description', t.rubric_description,"
        + " 'attributes', t.attributes, 'weight', t.weight"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, career_position_id, responsibility_id, ability_point_id, source,"
        + " domain, required_level, rubric_description, attributes, weight"
        + " FROM position_ability_bindings WHERE career_position_id = #{positionId}) t")
    String buildPositionAbilityBindings(@Param("positionId") String positionId);

    /** 能力域数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'career_position_id', t.career_position_id, 'name', t.name, 'description', t.description,"
        + " 'binding_ids', t.binding_ids, 'sort_order', t.sort_order"
        + ") ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, career_position_id, name, description, binding_ids, sort_order"
        + " FROM ability_domains WHERE career_position_id = #{positionId}) t")
    String buildAbilityDomains(@Param("positionId") String positionId);

    /** 岗位证书数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'career_position_id', t.career_position_id, 'certificate_library_id', t.certificate_library_id"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, career_position_id, certificate_library_id"
        + " FROM position_certificates WHERE career_position_id = #{positionId}) t")
    String buildPositionCertificates(@Param("positionId") String positionId);

    /** 认定规则数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'career_position_id', t.career_position_id, 'status', t.status,"
        + " 'rule_source', t.rule_source, 'level_mapping', t.level_mapping"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, career_position_id, status, rule_source, level_mapping"
        + " FROM certification_rules WHERE career_position_id = #{positionId}) t")
    String buildCertificationRules(@Param("positionId") String positionId);

    /** 认定权重数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'rule_id', t.rule_id, 'ability_point_id', t.ability_point_id, 'task_id', t.task_id, 'weight', t.weight"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, rule_id, ability_point_id, task_id, weight FROM certification_weights"
        + " WHERE rule_id IN (SELECT id FROM certification_rules WHERE career_position_id = #{positionId})) t")
    String buildCertificationWeights(@Param("positionId") String positionId);

    /** 认定能力条目数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'rule_id', t.rule_id, 'name', t.name, 'sort_order', t.sort_order"
        + ") ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, rule_id, name, sort_order"
        + " FROM certification_ability_items WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{positionId})) t")
    String buildCertificationAbilityItems(@Param("positionId") String positionId);

    /** 认定能力点数组。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + " 'id', t.id, 'item_id', t.item_id, 'ability_point_id', t.ability_point_id,"
        + " 'mapping_type', t.mapping_type, 'custom_level_mapping', t.custom_level_mapping,"
        + " 'required_level', t.required_level, 'weight', t.weight"
        + ") ORDER BY t.id), '[]') FROM (SELECT id, item_id, ability_point_id, mapping_type, custom_level_mapping,"
        + " required_level, weight FROM certification_ability_points WHERE item_id IN"
        + " (SELECT id FROM certification_ability_items WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{positionId}))) t")
    String buildCertificationAbilityPoints(@Param("positionId") String positionId);

    /** 岗位引用的能力点 ID 集合（绑定 + 认定引用去重；空集合返回空数组）。 */
    @Select("SELECT COALESCE(JSON_ARRAYAGG(x), JSON_ARRAY()) FROM (SELECT DISTINCT x FROM ("
        + " SELECT pab.ability_point_id AS x FROM position_ability_bindings pab WHERE pab.career_position_id = #{positionId}"
        + " UNION SELECT cap.ability_point_id FROM certification_ability_points cap WHERE cap.item_id IN"
        + " (SELECT id FROM certification_ability_items WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{positionId}))) u) v")
    String collectPositionAbilityPointIds(@Param("positionId") String positionId);
}
