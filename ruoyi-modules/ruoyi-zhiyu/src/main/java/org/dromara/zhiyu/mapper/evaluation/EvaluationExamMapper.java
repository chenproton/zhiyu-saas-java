package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.portal.PortalExam;

import java.util.List;

/**
 * 试卷 Mapper（exams 表，复用 {@link PortalExam} 实体）。
 *
 * @author zhiyu
 */
public interface EvaluationExamMapper extends BaseMapperPlus<PortalExam, PortalExam> {

    @Insert("INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration, cover_image,"
        + " collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, creator_id, is_temp)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, #{description}, 'draft', 0, #{duration}, #{coverImage},"
        + " #{collaboratorIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{collaboratorDeptIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{batchId}, 'V1.0', 'mine', #{creatorId}, #{isTemp})")
    int insertExam(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                   @Param("name") String name, @Param("description") String description,
                   @Param("duration") Integer duration, @Param("coverImage") String coverImage,
                   @Param("collaboratorIds") List<String> collaboratorIds,
                   @Param("collaboratorDeptIds") List<String> collaboratorDeptIds,
                   @Param("batchId") String batchId, @Param("creatorId") String creatorId,
                   @Param("isTemp") Boolean isTemp);

    @Update("UPDATE exams SET name = #{name}, description = #{description}, duration = #{duration},"
        + " cover_image = #{coverImage},"
        + " collaborator_ids = #{collaboratorIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " collaborator_dept_ids = #{collaboratorDeptIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " batch_id = #{batchId}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateExam(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                   @Param("description") String description, @Param("duration") Integer duration,
                   @Param("coverImage") String coverImage, @Param("collaboratorIds") List<String> collaboratorIds,
                   @Param("collaboratorDeptIds") List<String> collaboratorDeptIds, @Param("batchId") String batchId);

    @Select("SELECT EXISTS(SELECT 1 FROM exams WHERE tenant_id = #{tenantId} AND code = #{code})")
    boolean existsCode(@Param("tenantId") String tenantId, @Param("code") String code);

    /** live 当前版本（快照缺档回退用，对齐 Go ResolveResourceVersion） */
    @Select("SELECT COALESCE(version, '') FROM exams WHERE tenant_id = #{tenantId} AND id = #{id}")
    String selectVersion(@Param("tenantId") String tenantId, @Param("id") String id);

    /** 按名称复用已有临时卷（发布测评重新生成时避免唯一键冲突，对齐 Go CreateTempExam）。 */
    @Select("SELECT id FROM exams WHERE tenant_id = #{tenantId} AND name = #{name} AND is_temp = TRUE LIMIT 1")
    String selectTempExamId(@Param("tenantId") String tenantId, @Param("name") String name);

    /** 创建临时考试（status=published，is_temp=TRUE，对齐 Go CreateTempExam）。 */
    @Insert("INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration, cover_image,"
        + " collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, creator_id, is_temp)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, '', 'published', 0, #{duration}, NULL,"
        + " '{}', '{}', NULL, 'V1.0', 'mine', #{creatorId}, TRUE)")
    int insertTempExam(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                       @Param("name") String name, @Param("duration") Integer duration,
                       @Param("creatorId") String creatorId);

    /** CAS 状态流转（限定租户 + 状态，防并发双发） */
    @Update("UPDATE exams SET status = #{toStatus}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = #{fromStatus}")
    int casTransition(@Param("id") String id, @Param("tenantId") String tenantId,
                      @Param("fromStatus") String fromStatus, @Param("toStatus") String toStatus);

    /** 发布时版本 +0.1 */
    @Update("UPDATE exams SET version = #{version}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int bumpVersion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("version") String version);

    /** 邀请协作者（数组去重追加） */
    @Update("UPDATE exams SET collaborator_ids = JSON_ARRAY_APPEND(collaborator_ids, '$', #{userId}), updated_at = NOW()"
        + " WHERE id = #{id} AND NOT (JSON_CONTAINS(collaborator_ids, JSON_QUOTE(#{userId}), '$'))")
    int inviteCollaborator(@Param("id") String id, @Param("userId") String userId);

    /** 试卷是否存在成绩记录（删除保护） */
    @Select("SELECT EXISTS(SELECT 1 FROM exam_usages eu JOIN exam_results er ON er.exam_usage_id = eu.id"
        + " WHERE eu.exam_id = #{examId})")
    boolean examHasResults(@Param("examId") String examId);

    /** 从审批中撤回时删除待审批记录 */
    @org.apache.ibatis.annotations.Delete("DELETE FROM approval_records WHERE target_type = #{targetType}"
        + " AND target_id = #{targetId} AND status = 'pending'")
    int deletePendingApproval(@Param("targetType") String targetType, @Param("targetId") String targetId);
}
