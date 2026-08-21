package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.domain.scene.SceneEvalMethod;

import java.math.BigDecimal;
import java.util.List;

/**
 * 任务测评方式 Mapper（task_evaluation_methods 及子表，Go→Java 迁移）。
 *
 * <p>读取走 MyBatis-Plus 内置方法（jsonb 以 String 承载、数组列经
 * {@link PgArrayTypeHandler} 映射）；写入走自定义 SQL（jsonb/uuid[] 需显式 CAST）。</p>
 *
 * @author zhiyu
 */
public interface SceneEvalMethodMapper extends BaseMapperPlus<SceneEvalMethod, SceneEvalMethod> {

    /**
     * 任务级 advisory 锁（须在事务内调用，串行化并发保存；对齐 Go LockByKey）。
     */
    @Select("SELECT GET_LOCK(CONCAT('zhiyu:scene:', #{key}), 5)")
    void lockTaskEval(@Param("key") String key);

    /**
     * 查询任务当前最大版本（乐观锁；对齐 Go MaxMethodVersion）。
     */
    @Select("SELECT COALESCE(MAX(version), 0) FROM task_evaluation_methods WHERE task_id = #{taskId} AND tenant_id = #{tenantId}")
    Integer selectMaxVersion(@Param("taskId") String taskId, @Param("tenantId") String tenantId);

    /**
     * 查询任务名称（对齐 Go TaskName）。
     */
    @Select("SELECT name FROM scenario_tasks WHERE id = #{taskId}")
    String selectTaskName(@Param("taskId") String taskId);

    /**
     * 方法行 upsert（(task_id, method_key) 冲突时更新；rubric_template_id 恒不写入，
     * 评价标准为纯复制语义；对齐 Go SaveTaskMethod）。
     */
    @Select("INSERT INTO task_evaluation_methods (tenant_id, task_id, method_key, weight, eval_object, score_type,"
        + " eval_subjects, standard_name, standard_mode, resource_config, version, is_enabled)"
        + " VALUES (#{tenantId}, #{taskId}, #{methodKey}, #{weight}, #{evalObject}, #{scoreType},"
        + " CAST(#{evalSubjects} AS JSON), #{standardName}, #{standardMode}, CAST(#{resourceConfig} AS JSON),"
        + " #{version}, #{isEnabled})"
        + " ON DUPLICATE KEY UPDATE"
        + " weight = VALUES(weight), eval_object = VALUES(eval_object), score_type = VALUES(score_type),"
        + " eval_subjects = VALUES(eval_subjects), standard_name = VALUES(standard_name),"
        + " standard_mode = VALUES(standard_mode), resource_config = VALUES(resource_config),"
        + " version = VALUES(version), is_enabled = VALUES(is_enabled), updated_at = now()"
        + " RETURNING id")
    String upsertMethodReturnId(@Param("tenantId") String tenantId, @Param("taskId") String taskId,
                                @Param("methodKey") String methodKey, @Param("weight") BigDecimal weight,
                                @Param("evalObject") String evalObject, @Param("scoreType") String scoreType,
                                @Param("evalSubjects") String evalSubjects, @Param("standardName") String standardName,
                                @Param("standardMode") String standardMode, @Param("resourceConfig") String resourceConfig,
                                @Param("version") Integer version, @Param("isEnabled") Boolean isEnabled);

    /** 删除测评方法的评估点（config 重写前清空）。 */
    @Delete("DELETE FROM task_eval_points WHERE config_id = #{configId}")
    int deleteEvalPointsByConfig(@Param("configId") String configId);

    /** 删除测评方法的评分规则（config 重写前清空）。 */
    @Delete("DELETE FROM task_eval_score_rules WHERE config_id = #{configId}")
    int deleteScoreRulesByConfig(@Param("configId") String configId);

    /** 删除测评方法的评审步骤（config 重写前清空）。 */
    @Delete("DELETE FROM task_review_steps WHERE config_id = #{configId}")
    int deleteReviewStepsByConfig(@Param("configId") String configId);

    /**
     * 插入评估点（对齐 Go SaveTaskMethod 子表插入）。
     */
    @Insert("INSERT INTO task_eval_points (tenant_id, config_id, name, description, sub_type, types, weight,"
        + " scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order)"
        + " VALUES (#{tenantId}, #{configId}, #{name}, #{description}, #{subType},"
        + " #{types, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler}, #{weight},"
        + " #{scoringMethod}, CAST(#{gradeMapping} AS JSON),"
        + " #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{sortOrder})")
    int insertEvalPoint(@Param("tenantId") String tenantId, @Param("configId") String configId,
                        @Param("name") String name, @Param("description") String description,
                        @Param("subType") String subType, @Param("types") List<String> types,
                        @Param("weight") BigDecimal weight, @Param("scoringMethod") String scoringMethod,
                        @Param("gradeMapping") String gradeMapping,
                        @Param("knowledgePointIds") List<String> knowledgePointIds,
                        @Param("abilityPointIds") List<String> abilityPointIds, @Param("sortOrder") Integer sortOrder);

    /**
     * 插入评分规则（对齐 Go SaveTaskMethod 子表插入）。
     */
    @Insert("INSERT INTO task_eval_score_rules (tenant_id, config_id, name, description, rule, weight, sort_order)"
        + " VALUES (#{tenantId}, #{configId}, #{name}, #{description}, #{rule}, #{weight}, #{sortOrder})")
    int insertScoreRule(@Param("tenantId") String tenantId, @Param("configId") String configId,
                        @Param("name") String name, @Param("description") String description,
                        @Param("rule") String rule, @Param("weight") BigDecimal weight,
                        @Param("sortOrder") Integer sortOrder);

    /**
     * 插入评审步骤（对齐 Go SaveTaskMethod 子表插入）。
     */
    @Insert("INSERT INTO task_review_steps (tenant_id, config_id, label, description, enabled, subject_type, weight,"
        + " sort_order, assigned_user_ids)"
        + " VALUES (#{tenantId}, #{configId}, #{label}, #{description}, #{enabled}, #{subjectType}, #{weight},"
        + " #{sortOrder},"
        + " #{assignedUserIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler})")
    int insertReviewStep(@Param("tenantId") String tenantId, @Param("configId") String configId,
                         @Param("label") String label, @Param("description") String description,
                         @Param("enabled") Boolean enabled, @Param("subjectType") String subjectType,
                         @Param("weight") BigDecimal weight, @Param("sortOrder") Integer sortOrder,
                         @Param("assignedUserIds") List<String> assignedUserIds);

    /**
     * 已启用测评方法 key 列表（导出/快照辅助；对齐 Go ListEnabledMethodKeys）。
     */
    @Select("SELECT method_key FROM task_evaluation_methods WHERE task_id = #{taskId} AND tenant_id = #{tenantId}"
        + " AND is_enabled = true ORDER BY method_key")
    List<String> selectEnabledMethodKeys(@Param("taskId") String taskId, @Param("tenantId") String tenantId);
}
