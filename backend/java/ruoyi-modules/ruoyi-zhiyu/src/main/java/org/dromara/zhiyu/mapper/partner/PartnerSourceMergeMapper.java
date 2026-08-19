package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.Map;

/**
 * 学校自建资源编辑稿「审批通过 → 合并覆盖回原资源」SQL
 * （对齐 Go store/store.go MergeSourceEditDraft + alliance_source_edit_store.go
 * MergePositionDraftToSource / MergeScenarioDraftToSource）。
 *
 * <p>合并语义：用 draft 主表字段覆盖原资源（归属字段 code/batch_id/created_by 保留原值），
 * 子表行改挂原资源（保留子表 id），最后删除 draft。全流程在审批 review 的
 * {@code @Transactional} 内执行。</p>
 *
 * @author zhiyu
 */
public interface PartnerSourceMergeMapper {

    // ==================== 岗位 ====================

    /** 读 draft 名称与源资源 id（source_resource_id 为空说明非编辑稿）。 */
    @Select("SELECT name, source_resource_id::text AS source_resource_id FROM career_positions"
        + " WHERE id = #{draftId}::uuid AND tenant_id = #{tenantId}::uuid")
    Map<String, Object> selectPositionDraft(@Param("draftId") String draftId, @Param("tenantId") String tenantId);

    /** draft 临时改名，避免覆盖时与原资源同名冲突。 */
    @Update("UPDATE career_positions SET name = name || '-' || id WHERE id = #{draftId}::uuid")
    int renamePositionDraft(@Param("draftId") String draftId);

    /** 主表字段覆盖（对齐 Go MergePositionDraftToSource 的 UPDATE ... FROM d）。 */
    @Update("UPDATE career_positions cp SET name = #{finalName}, short_name = d.short_name,"
        + " industry_id = d.industry_id, position_type = d.position_type, salary_min = d.salary_min,"
        + " salary_max = d.salary_max, cover_image = d.cover_image, description = d.description,"
        + " requirements = d.requirements, career_path = d.career_path, version = d.version,"
        + " collaborators = d.collaborators, status = 'published', updated_at = NOW()"
        + " FROM career_positions d"
        + " WHERE cp.id = d.source_resource_id AND d.id = #{draftId}::uuid AND d.tenant_id = #{tenantId}::uuid")
    int overwritePositionFromDraft(@Param("draftId") String draftId, @Param("tenantId") String tenantId,
                                   @Param("finalName") String finalName);

    @Delete("DELETE FROM career_position_majors WHERE career_position_id ="
        + " (SELECT source_resource_id FROM career_positions WHERE id = #{draftId}::uuid)")
    int deleteSourcePositionMajors(@Param("draftId") String draftId);
    @Update("UPDATE career_position_majors SET career_position_id ="
        + " (SELECT source_resource_id FROM career_positions WHERE id = #{draftId}::uuid)"
        + " WHERE career_position_id = #{draftId}::uuid")
    int movePositionMajorsToSource(@Param("draftId") String draftId);

    @Delete("DELETE FROM position_ability_bindings WHERE career_position_id ="
        + " (SELECT source_resource_id FROM career_positions WHERE id = #{draftId}::uuid)")
    int deleteSourcePositionAbilityBindings(@Param("draftId") String draftId);
    @Update("UPDATE position_ability_bindings SET career_position_id ="
        + " (SELECT source_resource_id FROM career_positions WHERE id = #{draftId}::uuid)"
        + " WHERE career_position_id = #{draftId}::uuid")
    int movePositionAbilityBindingsToSource(@Param("draftId") String draftId);

    @Delete("DELETE FROM position_certificates WHERE career_position_id ="
        + " (SELECT source_resource_id FROM career_positions WHERE id = #{draftId}::uuid)")
    int deleteSourcePositionCertificates(@Param("draftId") String draftId);
    @Update("UPDATE position_certificates SET career_position_id ="
        + " (SELECT source_resource_id FROM career_positions WHERE id = #{draftId}::uuid)"
        + " WHERE career_position_id = #{draftId}::uuid")
    int movePositionCertificatesToSource(@Param("draftId") String draftId);

    @Delete("DELETE FROM position_responsibilities WHERE career_position_id ="
        + " (SELECT source_resource_id FROM career_positions WHERE id = #{draftId}::uuid)")
    int deleteSourcePositionResponsibilities(@Param("draftId") String draftId);
    @Update("UPDATE position_responsibilities SET career_position_id ="
        + " (SELECT source_resource_id FROM career_positions WHERE id = #{draftId}::uuid)"
        + " WHERE career_position_id = #{draftId}::uuid")
    int movePositionResponsibilitiesToSource(@Param("draftId") String draftId);

    @Delete("DELETE FROM career_positions WHERE id = #{draftId}::uuid AND tenant_id = #{tenantId}::uuid")
    int deletePositionDraft(@Param("draftId") String draftId, @Param("tenantId") String tenantId);

    // ==================== 场景 ====================

    @Select("SELECT name, source_resource_id::text AS source_resource_id FROM scenarios"
        + " WHERE id = #{draftId}::uuid AND tenant_id = #{tenantId}::uuid")
    Map<String, Object> selectScenarioDraft(@Param("draftId") String draftId, @Param("tenantId") String tenantId);

    @Update("UPDATE scenarios SET name = name || '-' || id WHERE id = #{draftId}::uuid AND tenant_id = #{tenantId}::uuid")
    int renameScenarioDraft(@Param("draftId") String draftId, @Param("tenantId") String tenantId);

    @Delete("DELETE FROM task_evaluation_methods WHERE task_id IN"
        + " (SELECT id FROM scenario_tasks WHERE scenario_id ="
        + " (SELECT source_resource_id FROM scenarios WHERE id = #{draftId}::uuid))")
    int deleteSourceTaskEvaluationMethods(@Param("draftId") String draftId);
    @Delete("DELETE FROM task_knowledge_bindings WHERE task_id IN"
        + " (SELECT id FROM scenario_tasks WHERE scenario_id ="
        + " (SELECT source_resource_id FROM scenarios WHERE id = #{draftId}::uuid))")
    int deleteSourceTaskKnowledgeBindings(@Param("draftId") String draftId);
    @Delete("DELETE FROM task_resource_bindings WHERE task_id IN"
        + " (SELECT id FROM scenario_tasks WHERE scenario_id ="
        + " (SELECT source_resource_id FROM scenarios WHERE id = #{draftId}::uuid))")
    int deleteSourceTaskResourceBindings(@Param("draftId") String draftId);
    @Delete("DELETE FROM scenario_weight_configs WHERE task_id IN"
        + " (SELECT id FROM scenario_tasks WHERE scenario_id ="
        + " (SELECT source_resource_id FROM scenarios WHERE id = #{draftId}::uuid))")
    int deleteSourceScenarioWeightConfigs(@Param("draftId") String draftId);

    @Delete("DELETE FROM scenario_tasks WHERE scenario_id ="
        + " (SELECT source_resource_id FROM scenarios WHERE id = #{draftId}::uuid)")
    int deleteSourceScenarioTasks(@Param("draftId") String draftId);

    @Update("UPDATE scenarios sc SET name = #{finalName}, cover_image = d.cover_image,"
        + " career_position_id = d.career_position_id, industry_ids = d.industry_ids,"
        + " profession_ids = d.profession_ids, difficulty = d.difficulty, version = d.version,"
        + " background = d.background, delivery_goal = d.delivery_goal, co_builder_ids = d.co_builder_ids,"
        + " status = 'published', publish_time = NOW(), updated_at = NOW()"
        + " FROM scenarios d"
        + " WHERE sc.id = d.source_resource_id AND d.id = #{draftId}::uuid AND d.tenant_id = #{tenantId}::uuid")
    int overwriteScenarioFromDraft(@Param("draftId") String draftId, @Param("tenantId") String tenantId,
                                   @Param("finalName") String finalName);

    @Update("UPDATE scenario_tasks SET scenario_id ="
        + " (SELECT source_resource_id FROM scenarios WHERE id = #{draftId}::uuid)"
        + " WHERE scenario_id = #{draftId}::uuid")
    int moveScenarioTasksToSource(@Param("draftId") String draftId);

    @Delete("DELETE FROM scenarios WHERE id = #{draftId}::uuid AND tenant_id = #{tenantId}::uuid")
    int deleteScenarioDraft(@Param("draftId") String draftId, @Param("tenantId") String tenantId);

    // ==================== 版本 bump（对齐 Go BumpVersionAndSnapshot 的 version 部分，快照另见 P2） ====================

    @Select("SELECT COALESCE(version, '') FROM career_positions WHERE id = #{id}::uuid AND tenant_id = #{tenantId}::uuid")
    String selectPositionVersion(@Param("tenantId") String tenantId, @Param("id") String id);

    @Update("UPDATE career_positions SET version = #{version}, updated_at = NOW() WHERE id = #{id}::uuid AND tenant_id = #{tenantId}::uuid")
    int updatePositionVersion(@Param("tenantId") String tenantId, @Param("id") String id, @Param("version") String version);

    @Select("SELECT COALESCE(version, '') FROM scenarios WHERE id = #{id}::uuid AND tenant_id = #{tenantId}::uuid")
    String selectScenarioVersion(@Param("tenantId") String tenantId, @Param("id") String id);

    @Update("UPDATE scenarios SET version = #{version}, updated_at = NOW() WHERE id = #{id}::uuid AND tenant_id = #{tenantId}::uuid")
    int updateScenarioVersion(@Param("tenantId") String tenantId, @Param("id") String id, @Param("version") String version);
}
