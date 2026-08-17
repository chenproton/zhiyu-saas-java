package org.dromara.zhiyu.mapper.portal;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.portal.PortalCourse;

import java.math.BigDecimal;
import java.util.List;

/**
 * 课程 Mapper（courses 表，lesson 域课程工作流 + portal 收藏列表共用）。
 *
 * <p>读取走 MyBatis-Plus 内置方法（数组列经 PgArrayTypeHandler 映射）；
 * 写入走自定义 SQL——uuid[] 数组列需显式 CAST 才能写入 PG 数组列。</p>
 *
 * @author zhiyu
 */
public interface PortalCourseMapper extends BaseMapperPlus<PortalCourse, PortalCourse> {

    /** 查询课程租户（归属校验用）。 */
    @Select("SELECT tenant_id FROM courses WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    /** 校验课程编码在租户内是否存在（code 唯一性判定）。 */
    @Select("SELECT EXISTS(SELECT 1 FROM courses WHERE tenant_id = #{tenantId} AND code = #{code})")
    boolean existsCode(@Param("tenantId") String tenantId, @Param("code") String code);

    /**
     * 创建课程（status 恒为 draft，node_count/resource_count/study_count 恒为 0）。
     */
    @Insert("INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,"
        + " online_hours, offline_hours, online_weight, offline_weight, semester, class_name,"
        + " status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,"
        + " knowledge_point_ids, ability_point_ids, resource_ids, eval_data, node_count, resource_count, study_count)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{code}, #{name}, #{type}, #{category}, #{majorId}::uuid, #{teacherId}::uuid,"
        + " #{industryId}::uuid, #{version}, #{onlineHours}, #{offlineHours}, #{onlineWeight}, #{offlineWeight},"
        + " #{semester}, #{className}, 'draft', #{coverColor}, #{coverImage}, #{courseTag}, #{difficulty}, #{description},"
        + " #{creatorId}::uuid,"
        + " CAST(#{coCreatorIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " #{batchId}::uuid,"
        + " CAST(#{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " CAST(#{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " CAST(#{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " CAST(#{evalData} AS jsonb), 0, 0, 0)")
    int insertCourse(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                     @Param("name") String name, @Param("type") String type, @Param("category") String category,
                     @Param("majorId") String majorId, @Param("teacherId") String teacherId,
                     @Param("industryId") String industryId, @Param("version") String version,
                     @Param("onlineHours") BigDecimal onlineHours, @Param("offlineHours") BigDecimal offlineHours,
                     @Param("onlineWeight") BigDecimal onlineWeight, @Param("offlineWeight") BigDecimal offlineWeight,
                     @Param("semester") String semester, @Param("className") String className,
                     @Param("coverColor") String coverColor, @Param("coverImage") String coverImage,
                     @Param("courseTag") String courseTag, @Param("difficulty") Integer difficulty,
                     @Param("description") String description, @Param("creatorId") String creatorId,
                     @Param("coCreatorIds") List<String> coCreatorIds, @Param("batchId") String batchId,
                     @Param("knowledgePointIds") List<String> knowledgePointIds,
                     @Param("abilityPointIds") List<String> abilityPointIds,
                     @Param("resourceIds") List<String> resourceIds, @Param("evalData") String evalData);

    /**
     * 更新课程（code 不变；resource_count 按 resource_ids 数组长度重算；限定租户）。
     */
    @Update("UPDATE courses SET name = #{name}, type = #{type}, category = #{category}, major_id = #{majorId}::uuid,"
        + " teacher_id = #{teacherId}::uuid, industry_id = #{industryId}::uuid, version = #{version},"
        + " online_hours = #{onlineHours}, offline_hours = #{offlineHours}, online_weight = #{onlineWeight},"
        + " offline_weight = #{offlineWeight}, semester = #{semester}, class_name = #{className},"
        + " cover_color = #{coverColor}, cover_image = #{coverImage}, course_tag = #{courseTag},"
        + " difficulty = #{difficulty}, description = #{description},"
        + " co_creator_ids = CAST(#{coCreatorIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " batch_id = #{batchId}::uuid,"
        + " knowledge_point_ids = CAST(#{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " ability_point_ids = CAST(#{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " resource_ids = CAST(#{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " eval_data = CAST(#{evalData} AS jsonb),"
        + " resource_count = COALESCE(array_length(CAST(#{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]), 1), 0),"
        + " updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateCourse(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                     @Param("type") String type, @Param("category") String category, @Param("majorId") String majorId,
                     @Param("teacherId") String teacherId, @Param("industryId") String industryId,
                     @Param("version") String version, @Param("onlineHours") BigDecimal onlineHours,
                     @Param("offlineHours") BigDecimal offlineHours, @Param("onlineWeight") BigDecimal onlineWeight,
                     @Param("offlineWeight") BigDecimal offlineWeight, @Param("semester") String semester,
                     @Param("className") String className, @Param("coverColor") String coverColor,
                     @Param("coverImage") String coverImage, @Param("courseTag") String courseTag,
                     @Param("difficulty") Integer difficulty, @Param("description") String description,
                     @Param("coCreatorIds") List<String> coCreatorIds, @Param("batchId") String batchId,
                     @Param("knowledgePointIds") List<String> knowledgePointIds,
                     @Param("abilityPointIds") List<String> abilityPointIds,
                     @Param("resourceIds") List<String> resourceIds, @Param("evalData") String evalData);

    /**
     * 状态流转（CAS 更新，仅当状态仍为 currentStatus 时生效，防并发双发）。
     */
    @Update("UPDATE courses SET status = #{toStatus}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = #{currentStatus}")
    int casTransition(@Param("id") String id, @Param("tenantId") String tenantId,
                      @Param("currentStatus") String currentStatus, @Param("toStatus") String toStatus);

    /** 审核（仅 pending → approved/rejected；CAS 更新）。 */
    @Update("UPDATE courses SET status = #{toStatus}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = 'pending'")
    int casReview(@Param("id") String id, @Param("tenantId") String tenantId, @Param("toStatus") String toStatus);

    /** 发布时递增版本号。 */
    @Update("UPDATE courses SET version = #{version}, updated_at = NOW() WHERE id = #{id}")
    int bumpVersion(@Param("id") String id, @Param("version") String version);

    /** 邀请协作者（co_creator_ids 数组追加，幂等）。 */
    @Update("UPDATE courses SET co_creator_ids = array_append(co_creator_ids, #{userId}::uuid), updated_at = NOW()"
        + " WHERE id = #{id} AND NOT (co_creator_ids @> ARRAY[#{userId}::uuid])")
    int inviteCollaborator(@Param("id") String id, @Param("userId") String userId);

    /** 课程删除保护：存在课程/节点测评成绩或节点考试结果时拒绝物理删除。 */
    @Select("SELECT EXISTS(SELECT 1 FROM course_evaluation_results WHERE course_id = #{id})"
        + " OR EXISTS(SELECT 1 FROM node_evaluation_results WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id = #{id}))"
        + " OR EXISTS(SELECT 1 FROM exam_results er JOIN exam_usages eu ON eu.id = er.exam_usage_id"
        + " WHERE eu.target_type = 'node' AND eu.target_ids && (SELECT COALESCE(array_agg(id), '{}') FROM system_course_nodes WHERE course_id = #{id}))")
    boolean existsEvaluationResults(@Param("id") String id);

    /** 删除前解绑培养方案引用。 */
    @Update("UPDATE training_program_courses SET course_id = NULL WHERE course_id = #{id}")
    int unbindTrainingPrograms(@Param("id") String id);

    /** 删除前解绑教学计划引用。 */
    @Update("UPDATE teaching_plan_entries SET course_id = NULL WHERE course_id = #{id}")
    int unbindTeachingPlans(@Param("id") String id);

    /** 删除前解绑日程引用。 */
    @Update("UPDATE schedule_entries SET course_id = NULL WHERE course_id = #{id}")
    int unbindSchedules(@Param("id") String id);

    /** 删除课程作业提交。 */
    @Delete("DELETE FROM course_homework_submissions WHERE course_id = #{id}")
    int deleteCourseHomeworkSubmissions(@Param("id") String id);

    /** 删除课程作业。 */
    @Delete("DELETE FROM course_homeworks WHERE course_id = #{id}")
    int deleteCourseHomeworks(@Param("id") String id);

    /** 删除课程级考试安排（保留已有成绩的安排）。 */
    @Delete("DELETE FROM exam_usages WHERE target_type = 'course' AND #{id}::uuid = ANY(target_ids)"
        + " AND NOT EXISTS (SELECT 1 FROM exam_results er WHERE er.exam_usage_id = exam_usages.id)")
    int deleteCourseExamUsages(@Param("id") String id);

    /** 从知识点颗粒课反向引用中移除该课程。 */
    @Update("UPDATE knowledge_points SET granular_lesson_ids = array_remove(granular_lesson_ids, #{id})"
        + " WHERE #{id}::uuid = ANY(granular_lesson_ids)")
    int unbindKnowledgePointGranularRefs(@Param("id") String id);

    /** 删除课程（限定租户）。 */
    @Delete("DELETE FROM courses WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteCourse(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 撤回时删除待审批记录。 */
    @Delete("DELETE FROM approval_records WHERE target_type = 'course' AND target_id = #{courseId} AND status = 'pending'")
    int deletePendingApproval(@Param("courseId") String courseId);

    /** 清空课程知识点绑定（替换绑定用）。 */
    @Delete("DELETE FROM course_knowledge_bindings WHERE course_id = #{courseId}")
    int deleteCourseKnowledgeBindings(@Param("courseId") String courseId);

    /** 插入课程知识点绑定（幂等）。 */
    @Insert("INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)"
        + " VALUES (gen_random_uuid(), #{tenantId}::uuid, #{courseId}::uuid, #{kpId}::uuid, 'course', #{sourceId}::uuid)"
        + " ON CONFLICT (course_id, knowledge_point_id, bind_type, source_id) DO NOTHING")
    int insertCourseKnowledgeBinding(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                                     @Param("kpId") String kpId, @Param("sourceId") String sourceId);

    /** 清空课程资源绑定（替换绑定用）。 */
    @Delete("DELETE FROM course_resource_bindings WHERE course_id = #{courseId}")
    int deleteCourseResourceBindings(@Param("courseId") String courseId);

    /** 插入课程资源绑定（幂等）。 */
    @Insert("INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)"
        + " VALUES (gen_random_uuid(), #{tenantId}::uuid, #{courseId}::uuid, #{resourceId}::uuid)"
        + " ON CONFLICT (course_id, resource_id) DO NOTHING")
    int insertCourseResourceBinding(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                                    @Param("resourceId") String resourceId);
}
