package org.dromara.zhiyu.mapper.importexport;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 场景 Excel 导入 SQL（对齐 Go store/scenario_import_export.go）。
 *
 * <p>仅承载导入用 SQL；业务编排在 ImportExportServiceImpl.importScenarios。
 * 全部 SQL 显式携带 {@code tenant_id} 过滤（租户安全红线）。uuid[]/varchar[] 数组列
 * 经 {@link JsonStringArrayTypeHandler} 映射并显式 CAST。</p>
 *
 * @author zhiyu
 */
public interface ScenarioImportMapper {

    /** 按租户+名称查询场景身份（导入查重）：返回 id/creator_id/co_builder_ids。 */
    @Select("SELECT id AS id, COALESCE(creator_id, '') AS creator_id, co_builder_ids AS co_builder_ids"
        + " FROM scenarios WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    Map<String, Object> selectScenarioIdentity(@Param("tenantId") String tenantId, @Param("name") String name);

    /** 按租户+名称查询场景 ID（rename 模式判重）。 */
    @Select("SELECT id FROM scenarios WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectScenarioIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    /** 覆盖导入：更新场景基础字段（限定租户）。 */
    @Update("UPDATE scenarios SET name = #{name}, career_position_id = #{careerPositionId},"
        + " industry_ids = #{industryIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " profession_ids = #{professionIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " batch_id = #{batchId}, difficulty = #{difficulty}, background = #{background}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateScenarioImport(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                             @Param("careerPositionId") String careerPositionId,
                             @Param("industryIds") List<String> industryIds,
                             @Param("professionIds") List<String> professionIds,
                             @Param("batchId") String batchId, @Param("difficulty") Integer difficulty,
                             @Param("background") String background);

    /** 覆盖导入：清空场景原有测评方式（先删测评方式再删任务，与 Go 两条删除独立执行一致）。 */
    @Delete("DELETE FROM task_evaluation_methods WHERE task_id IN"
        + " (SELECT id FROM scenario_tasks WHERE scenario_id = #{scenarioId})")
    int deleteTaskEvalMethodsByScenario(@Param("scenarioId") String scenarioId);

    /** 覆盖导入：清空场景原有任务。 */
    @Delete("DELETE FROM scenario_tasks WHERE scenario_id = #{scenarioId}")
    int deleteScenarioTasks(@Param("scenarioId") String scenarioId);

    /** 导入创建场景（draft 状态，co_builder_ids 空数组）。 */
    @Insert("INSERT INTO scenarios (id, tenant_id, name, code, career_position_id, industry_ids, profession_ids,"
        + " batch_id, difficulty, version, status, background, creator_id, co_builder_ids)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{code}, #{careerPositionId},"
        + " #{industryIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{professionIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{batchId}, #{difficulty}, 'V1.0', 'draft', #{background}, #{creatorId}, JSON_ARRAY())")
    int insertScenario(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                       @Param("code") String code, @Param("careerPositionId") String careerPositionId,
                       @Param("industryIds") List<String> industryIds,
                       @Param("professionIds") List<String> professionIds,
                       @Param("batchId") String batchId, @Param("difficulty") Integer difficulty,
                       @Param("background") String background, @Param("creatorId") String creatorId);

    /** 导入创建场景任务（eval_data/dependency_ids 空数组，非引用任务）。 */
    @Insert("INSERT INTO scenario_tasks (id, tenant_id, scenario_id, name, code, sort_order, background,"
        + " detailed_description, estimated_hours, task_type, difficulty, knowledge_point_ids, ability_point_ids,"
        + " resource_ids, eval_data, dependency_ids, is_referenced)"
        + " VALUES (#{id}, #{tenantId}, #{scenarioId}, #{name}, #{code}, #{sortOrder},"
        + " #{background}, #{detailedDescription}, #{estimatedHours}, #{taskType}, #{difficulty},"
        + " #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " '{}', '{}', false)")
    int insertScenarioTask(@Param("id") String id, @Param("tenantId") String tenantId,
                           @Param("scenarioId") String scenarioId, @Param("name") String name,
                           @Param("code") String code, @Param("sortOrder") Integer sortOrder,
                           @Param("background") String background,
                           @Param("detailedDescription") String detailedDescription,
                           @Param("estimatedHours") BigDecimal estimatedHours, @Param("taskType") String taskType,
                           @Param("difficulty") Integer difficulty,
                           @Param("knowledgePointIds") List<String> knowledgePointIds,
                           @Param("abilityPointIds") List<String> abilityPointIds,
                           @Param("resourceIds") List<String> resourceIds);

    /** 导入写入任务测评方式（等分权重，ON CONFLICT 更新）。 */
    @Insert("INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, eval_object,"
        + " score_type, eval_subjects, rubric_template_id, resource_config, version, is_enabled)"
        + " VALUES (#{id}, #{tenantId}, #{taskId}, #{methodKey}, #{weight}, 'individual', NULL,"
        + " '[]', NULL, '{}', 1, true)"
        + " ON DUPLICATE KEY UPDATE"
        + " weight = VALUES(weight), eval_object = VALUES(eval_object), score_type = VALUES(score_type),"
        + " eval_subjects = VALUES(eval_subjects), rubric_template_id = VALUES(rubric_template_id),"
        + " resource_config = VALUES(resource_config), version = VALUES(version),"
        + " is_enabled = VALUES(is_enabled), updated_at = NOW()")
    int upsertTaskEvalMethod(@Param("id") String id, @Param("tenantId") String tenantId,
                             @Param("taskId") String taskId, @Param("methodKey") String methodKey,
                             @Param("weight") BigDecimal weight);

    /** 按租户+名称查找专业 ID（对齐 Go LookupProfessionIDsByNames；MySQL 无 normalize 函数，直接按名称匹配）。 */
    @Select("SELECT id FROM majors WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectMajorIdByNameNfkc(@Param("tenantId") String tenantId, @Param("name") String name);

    /** 按租户+名称查找场景批次 ID（对齐 Go LookupBatchID(scene_batches)）。 */
    @Select("SELECT id FROM scene_batches WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectSceneBatchIdByName(@Param("tenantId") String tenantId, @Param("name") String name);
}
