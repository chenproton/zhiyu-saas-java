package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.domain.scene.SceneScenario;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 场景 Mapper（scenarios 表，Go→Java 迁移）。
 *
 * <p>读取走 MyBatis-Plus 内置方法（数组列经 {@link PgArrayTypeHandler} 映射）；
 * 写入走自定义 SQL——uuid[]/varchar[] 数组列需显式 CAST 才能写入 PG 数组列。</p>
 *
 * @author zhiyu
 */
public interface SceneScenarioMapper extends BaseMapperPlus<SceneScenario, SceneScenario> {

    /**
     * 创建场景（status 恒为 draft，对齐 Go store.ScenarioStore.Create）。
     */
    @Insert("INSERT INTO scenarios (id, name, code, cover_image, career_position_id, industry_ids,"
        + " profession_ids, batch_id, difficulty, version, status, background,"
        + " delivery_goal, creator_id, co_builder_ids, tenant_id, source_type, source_enterprise_id)"
        + " VALUES (#{id}, #{name}, #{code}, #{coverImage}, #{careerPositionId},"
        + " #{industryIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{professionIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{batchId}, #{difficulty}, #{version}, 'draft', #{background},"
        + " #{deliveryGoal}, #{creatorId},"
        + " #{coBuilderIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{tenantId}, COALESCE(#{sourceType}, 'school'), #{sourceEnterpriseId})")
    int insertScenario(@Param("id") String id, @Param("name") String name, @Param("code") String code,
                       @Param("coverImage") String coverImage, @Param("careerPositionId") String careerPositionId,
                       @Param("industryIds") List<String> industryIds, @Param("professionIds") List<String> professionIds,
                       @Param("batchId") String batchId, @Param("difficulty") Integer difficulty,
                       @Param("version") String version, @Param("background") String background,
                       @Param("deliveryGoal") String deliveryGoal, @Param("creatorId") String creatorId,
                       @Param("coBuilderIds") List<String> coBuilderIds, @Param("tenantId") String tenantId,
                       @Param("sourceType") String sourceType, @Param("sourceEnterpriseId") String sourceEnterpriseId);

    /**
     * 更新场景全部业务字段（部分更新语义由 Service 先合并再调用，对齐 Go ScenarioStore.Update）。
     */
    @Update("UPDATE scenarios SET name = #{name}, cover_image = #{coverImage}, career_position_id = #{careerPositionId},"
        + " industry_ids = #{industryIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " profession_ids = #{professionIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " batch_id = #{batchId}, difficulty = #{difficulty}, version = #{version},"
        + " background = #{background}, delivery_goal = #{deliveryGoal},"
        + " co_builder_ids = #{coBuilderIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " updated_at = NOW() WHERE id = #{id}")
    int updateScenario(@Param("id") String id, @Param("name") String name, @Param("coverImage") String coverImage,
                       @Param("careerPositionId") String careerPositionId, @Param("industryIds") List<String> industryIds,
                       @Param("professionIds") List<String> professionIds, @Param("batchId") String batchId,
                       @Param("difficulty") Integer difficulty, @Param("version") String version,
                       @Param("background") String background, @Param("deliveryGoal") String deliveryGoal,
                       @Param("coBuilderIds") List<String> coBuilderIds);

    /**
     * 邀请协作者（co_builder_ids 数组追加，幂等：已存在不重复追加）。
     */
    @Update("UPDATE scenarios SET co_builder_ids = JSON_ARRAY_APPEND(co_builder_ids, '$', #{userId}), updated_at = NOW()"
        + " WHERE id = #{id} AND NOT (JSON_CONTAINS(co_builder_ids, JSON_QUOTE(#{userId}), '$'))")
    int inviteCollaborator(@Param("id") String id, @Param("userId") String userId);

    /**
     * 状态流转（CAS 更新，仅当状态仍为 currentStatus 时生效，防并发双发；对齐 Go ContentActions.Transition）。
     *
     * @return 影响行数（0 表示状态已被并发修改）
     */
    @Update("UPDATE scenarios SET status = #{toStatus}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = #{currentStatus}")
    int casTransition(@Param("id") String id, @Param("tenantId") String tenantId,
                      @Param("currentStatus") String currentStatus, @Param("toStatus") String toStatus);

    /**
     * 审核（仅允许 pending → approved/rejected；CAS 更新）。
     *
     * @return 影响行数（0 表示不存在或不在待处理状态）
     */
    @Update("UPDATE scenarios SET status = #{toStatus}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = 'pending'")
    int casReview(@Param("id") String id, @Param("tenantId") String tenantId, @Param("toStatus") String toStatus);

    /**
     * 发布时递增版本号（V1.0→V1.1，1.9→2.0；版本值由 Service 用 NextVersion 计算）。
     */
    @Update("UPDATE scenarios SET version = #{version}, updated_at = NOW() WHERE id = #{id}")
    int bumpVersion(@Param("id") String id, @Param("version") String version);

    /**
     * 查询场景租户（归属校验用）。
     */
    @Select("SELECT tenant_id FROM scenarios WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    /**
     * 查询场景当前状态。
     */
    @Select("SELECT status FROM scenarios WHERE id = #{id}")
    String selectStatus(@Param("id") String id);

    /**
     * 校验场景编码在租户内是否存在（code 唯一性判定）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM scenarios WHERE tenant_id = #{tenantId} AND code = #{code})")
    boolean existsCode(@Param("tenantId") String tenantId, @Param("code") String code);

    /**
     * 场景测评成绩存在性（删除保护：存在 scene_id 或任务 task_id 关联成绩时拒绝物理删除）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM scene_evaluation_results ser"
        + " WHERE ser.scene_id = #{id} OR ser.task_id IN (SELECT id FROM scenario_tasks WHERE scenario_id = #{id}))")
    boolean existsEvaluationResults(@Param("id") String id);

    /** 解除教学计划条目对场景的引用（删除前清理，限定租户）。 */
    @Update("UPDATE teaching_plan_entries SET scenario_id = NULL WHERE scenario_id = #{id} AND tenant_id = #{tenantId}")
    int unbindTeachingPlanEntries(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 解除日程条目对场景的引用（删除前清理，限定租户）。 */
    @Update("UPDATE schedule_entries SET scenario_id = NULL WHERE scenario_id = #{id} AND tenant_id = #{tenantId}")
    int unbindScheduleEntries(@Param("id") String id, @Param("tenantId") String tenantId);

    /**
     * 记录浏览（view_logs 追加 + view_counters 累加，对齐 Go RecordView；失败仅记日志不阻塞）。
     */
    @Insert("INSERT INTO view_logs (target_type, target_id, user_id, tenant_id) VALUES ('scenario', #{targetId}, #{userId}, #{tenantId})")
    int insertViewLog(@Param("targetId") String targetId, @Param("userId") String userId, @Param("tenantId") String tenantId);

    /**
     * 浏览计数累加（ON CONFLICT 累加，对齐 Go RecordView 的 view_counters upsert）。
     */
    @Update("INSERT INTO view_counters (target_type, target_id, cnt) VALUES ('scenario', #{targetId}, 1)"
        + " ON DUPLICATE KEY UPDATE cnt = view_counters.cnt + 1, updated_at = now()")
    int incrementViewCounter(@Param("targetId") String targetId);

    /** 查询创建人姓名（详情/列表组装）。 */
    @Select("SELECT name FROM users WHERE id = #{id}")
    String selectUserName(@Param("id") String id);

    /**
     * 删除待审批记录（撤回时；对齐 Go ContentActions.Transition 的 pending→draft 清理）。
     */
    @Delete("DELETE FROM approval_records WHERE target_type = 'scenario' AND target_id = #{scenarioId} AND status = 'pending'")
    int deletePendingApproval(@Param("scenarioId") String scenarioId);

    /** 记录发布时间（对齐 Go 联盟合并路径 publish_time 语义；常规发布不写，保留此方法备用）。 */
    @Update("UPDATE scenarios SET publish_time = #{time}, updated_at = NOW() WHERE id = #{id}")
    int markPublishedTime(@Param("id") String id, @Param("time") OffsetDateTime time);
}
