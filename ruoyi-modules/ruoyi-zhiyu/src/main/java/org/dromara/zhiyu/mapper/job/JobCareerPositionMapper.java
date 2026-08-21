package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.domain.job.JobCareerPosition;

import java.util.List;

/**
 * 岗位 Mapper（career_positions 表，Go→Java 迁移）。
 *
 * <p>读取走 MyBatis-Plus 内置方法（数组列经 {@link PgArrayTypeHandler} 映射）；
 * 写入走自定义 SQL——uuid[]/text[] 数组列需显式 CAST 才能写入 PG 数组列。</p>
 *
 * @author zhiyu
 */
public interface JobCareerPositionMapper extends BaseMapperPlus<JobCareerPosition, JobCareerPosition> {

    /**
     * 创建岗位（status 由调用方传入，通常为 draft；source_type 默认 school）。
     */
    @Insert("INSERT INTO career_positions (id, tenant_id, code, batch_id, name, short_name, industry_id,"
        + " position_type, salary_min, salary_max, cover_image, description, requirements, career_path,"
        + " version, status, created_by, collaborators, source_type, source_enterprise_id)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{batchId}, #{name}, #{shortName}, #{industryId},"
        + " #{positionType}, #{salaryMin}, #{salaryMax}, #{coverImage}, #{description},"
        + " #{requirements, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{careerPath}, #{version}, #{status}, #{createdBy},"
        + " #{collaborators, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " COALESCE(#{sourceType}, 'school'), #{sourceEnterpriseId})")
    int insertPosition(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                       @Param("batchId") String batchId, @Param("name") String name,
                       @Param("shortName") String shortName, @Param("industryId") String industryId,
                       @Param("positionType") String positionType, @Param("salaryMin") Integer salaryMin,
                       @Param("salaryMax") Integer salaryMax, @Param("coverImage") String coverImage,
                       @Param("description") String description, @Param("requirements") List<String> requirements,
                       @Param("careerPath") String careerPath, @Param("version") String version,
                       @Param("status") String status, @Param("createdBy") String createdBy,
                       @Param("collaborators") List<String> collaborators, @Param("sourceType") String sourceType,
                       @Param("sourceEnterpriseId") String sourceEnterpriseId);

    /**
     * 更新岗位全部业务字段（部分更新语义由 Service 先合并再调用，对齐 Go PositionStore.Update）。
     */
    @Update("UPDATE career_positions SET"
        + " batch_id = #{batchId}, name = #{name}, short_name = #{shortName}, industry_id = #{industryId},"
        + " position_type = #{positionType}, salary_min = #{salaryMin}, salary_max = #{salaryMax},"
        + " cover_image = #{coverImage}, description = #{description},"
        + " requirements = #{requirements, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " career_path = #{careerPath}, version = #{version},"
        + " collaborators = #{collaborators, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " updated_at = NOW() WHERE id = #{id}")
    int updatePosition(@Param("id") String id, @Param("batchId") String batchId, @Param("name") String name,
                       @Param("shortName") String shortName, @Param("industryId") String industryId,
                       @Param("positionType") String positionType, @Param("salaryMin") Integer salaryMin,
                       @Param("salaryMax") Integer salaryMax, @Param("coverImage") String coverImage,
                       @Param("description") String description, @Param("requirements") List<String> requirements,
                       @Param("careerPath") String careerPath, @Param("version") String version,
                       @Param("collaborators") List<String> collaborators);

    /**
     * 状态流转（CAS 更新，仅当状态仍为 currentStatus 时生效，防并发双发；对齐 Go ContentActions.Transition）。
     *
     * @return 影响行数（0 表示状态已被并发修改）
     */
    @Update("UPDATE career_positions SET status = #{toStatus}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = #{currentStatus}")
    int casTransition(@Param("id") String id, @Param("tenantId") String tenantId,
                      @Param("currentStatus") String currentStatus, @Param("toStatus") String toStatus);

    /**
     * 审核（仅允许 pending → approved/rejected；CAS 更新）。
     *
     * @return 影响行数（0 表示不存在或不在待处理状态）
     */
    @Update("UPDATE career_positions SET status = #{toStatus}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = 'pending'")
    int casReview(@Param("id") String id, @Param("tenantId") String tenantId, @Param("toStatus") String toStatus);

    /**
     * 发布时递增版本号（V1.0→V1.1，1.9→2.0；版本值由 Service 用 NextVersion 计算）。
     */
    @Update("UPDATE career_positions SET version = #{version}, updated_at = NOW() WHERE id = #{id}")
    int bumpVersion(@Param("id") String id, @Param("version") String version);

    /**
     * 邀请协作者（collaborators 数组追加，幂等：已存在不重复追加）。
     */
    @Update("UPDATE career_positions SET collaborators = JSON_ARRAY_APPEND(collaborators, '$', #{userId}), updated_at = NOW()"
        + " WHERE id = #{id} AND NOT (JSON_CONTAINS(collaborators, JSON_QUOTE(#{userId}), '$'))")
    int inviteCollaborator(@Param("id") String id, @Param("userId") String userId);

    /**
     * 查询岗位租户（归属校验用）。
     */
    @Select("SELECT tenant_id FROM career_positions WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    /**
     * 校验岗位编码在租户内是否存在（code 唯一性判定）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM career_positions WHERE tenant_id = #{tenantId} AND code = #{code})")
    boolean existsCode(@Param("tenantId") String tenantId, @Param("code") String code);

    /**
     * 校验岗位名称在租户内是否存在（唯一约束冲突预判）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM career_positions WHERE tenant_id = #{tenantId} AND name = #{name} AND id <> #{id})")
    boolean existsName(@Param("tenantId") String tenantId, @Param("name") String name, @Param("id") String id);

    /**
     * 校验岗位名称在租户内是否存在（创建时；不含 id 排除条件）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM career_positions WHERE tenant_id = #{tenantId} AND name = #{name})")
    boolean existsNameNew(@Param("tenantId") String tenantId, @Param("name") String name);

    /**
     * 删除保护：存在岗位能力成绩/学生画像，或被已发布场景引用时拒绝物理删除（对齐 Go PositionStore.Delete）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM job_ability_results WHERE career_position_id = #{id})"
        + " OR EXISTS(SELECT 1 FROM student_ability_portraits WHERE career_position_id = #{id})"
        + " OR EXISTS(SELECT 1 FROM scenarios WHERE career_position_id = #{id} AND status = 'published')")
    boolean existsInUse(@Param("id") String id);

    /** 删除前清理：岗位能力成绩（无外键约束表，防孤儿数据）。 */
    @Delete("DELETE FROM job_ability_results WHERE career_position_id = #{id}")
    int cleanupJobAbilityResults(@Param("id") String id);

    /** 删除前清理：学生能力画像（无外键约束表）。 */
    @Delete("DELETE FROM student_ability_portraits WHERE career_position_id = #{id}")
    int cleanupStudentPortraits(@Param("id") String id);

    /** 删除前清理：能力聚合日志（无外键约束表）。 */
    @Delete("DELETE FROM job_ability_aggregate_logs WHERE career_position_id = #{id}")
    int cleanupAbilityAggregateLogs(@Param("id") String id);

    /** 删除前清理：认证权重（certification_weights 无 rule_id 外键需显式删除）。 */
    @Delete("DELETE FROM certification_weights WHERE rule_id IN (SELECT id FROM certification_rules WHERE career_position_id = #{id})")
    int cleanupCertificationWeights(@Param("id") String id);

    /** 删除前清理：认证等级数据（grade_data 级联删 leaderboard/competency）。 */
    @Delete("DELETE FROM certification_grade_data WHERE position_id = #{id}")
    int cleanupCertificationGradeData(@Param("id") String id);

    /** 删除前清理：认证规则（级联删 ability_items → ability_points → related_tasks）。 */
    @Delete("DELETE FROM certification_rules WHERE career_position_id = #{id}")
    int cleanupCertificationRules(@Param("id") String id);

    /** 删除前清理：浏览计数孤儿行。 */
    @Delete("DELETE FROM view_counters WHERE target_type = 'career_position' AND target_id = #{id}")
    int cleanupViewCounters(@Param("id") String id);

    /** 删除前清理：收藏计数孤儿行。 */
    @Delete("DELETE FROM favorite_counters WHERE target_type = 'career_position' AND target_id = #{id}")
    int cleanupFavoriteCounters(@Param("id") String id);

    /** 删除前清理：岗位收藏记录。 */
    @Delete("DELETE FROM position_favorites WHERE career_position_id = #{id}")
    int cleanupPositionFavorites(@Param("id") String id);

    /** 删除岗位本体（物理删除，对齐 Go）。 */
    @Delete("DELETE FROM career_positions WHERE id = #{id}")
    int deletePositionById(@Param("id") String id);

    /** 记录浏览（view_logs 追加 + 计数表累加，对齐 Go RecordView；失败仅记日志不阻塞）。 */
    @Insert("INSERT INTO view_logs (target_type, target_id, user_id, tenant_id)"
        + " VALUES ('career_position', #{targetId}, #{userId}, #{tenantId})")
    int insertViewLog(@Param("targetId") String targetId, @Param("userId") String userId,
                      @Param("tenantId") String tenantId);

    /**
     * 浏览计数累加（ON CONFLICT 累加，对齐 Go RecordView 的 view_counters upsert）。
     */
    @Update("INSERT INTO view_counters (target_type, target_id, cnt) VALUES ('career_position', #{targetId}, 1)"
        + " ON DUPLICATE KEY UPDATE cnt = view_counters.cnt + 1, updated_at = now()")
    int incrementViewCounter(@Param("targetId") String targetId);

    /**
     * 删除待审批记录（撤回时；approval_records 表 pending 清理，对齐 Go ContentActions）。
     */
    @Delete("DELETE FROM approval_records WHERE target_type = 'career_position' AND target_id = #{positionId} AND status = 'pending'")
    int deletePendingApproval(@Param("positionId") String positionId);

    /**
     * 收藏岗位 ID 列表（position_favorites JOIN career_positions，仅已发布；按创建时间倒序分页）。
     */
    @Select("SELECT cp.id FROM position_favorites pf"
        + " JOIN career_positions cp ON cp.id = pf.career_position_id"
        + " WHERE pf.user_id = #{userId} AND cp.tenant_id = #{tenantId} AND cp.status = 'published'"
        + " ORDER BY cp.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<String> selectFavoritePositionIds(@Param("userId") String userId, @Param("tenantId") String tenantId,
                                           @Param("limit") int limit, @Param("offset") int offset);

    /**
     * 收藏岗位总数（与 {@link #selectFavoritePositionIds} 同条件）。
     */
    @Select("SELECT COUNT(*) FROM position_favorites pf"
        + " JOIN career_positions cp ON cp.id = pf.career_position_id"
        + " WHERE pf.user_id = #{userId} AND cp.tenant_id = #{tenantId} AND cp.status = 'published'")
    long countFavoritePositions(@Param("userId") String userId, @Param("tenantId") String tenantId);
}
