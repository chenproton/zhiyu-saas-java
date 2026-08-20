package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationExamUsage;
import org.dromara.zhiyu.domain.portal.PortalExam;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 考试安排 Mapper（exam_usages 表；试卷 exams 复用 {@link PortalExam}）。
 *
 * @author zhiyu
 */
public interface EvaluationExamUsageMapper extends BaseMapperPlus<EvaluationExamUsage, EvaluationExamUsage> {

    @Insert("INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration,"
        + " target_type, target_ids, status, activation_mode, creator_id, exam_version)"
        + " VALUES (#{id}, #{tenantId}, #{examId}, #{name}, #{description}, #{startTime}, #{endTime}, #{duration},"
        + " #{targetType},"
        + " #{targetIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{status}, #{activationMode}, #{creatorId}, #{examVersion})")
    int insertUsage(@Param("id") String id, @Param("tenantId") String tenantId, @Param("examId") String examId,
                    @Param("name") String name, @Param("description") String description,
                    @Param("startTime") OffsetDateTime startTime, @Param("endTime") OffsetDateTime endTime,
                    @Param("duration") Integer duration, @Param("targetType") String targetType,
                    @Param("targetIds") List<String> targetIds, @Param("status") String status,
                    @Param("activationMode") String activationMode, @Param("creatorId") String creatorId,
                    @Param("examVersion") String examVersion);

    @Update("UPDATE exam_usages SET name = #{name}, description = COALESCE(#{description}, description),"
        + " start_time = COALESCE(#{startTime}, start_time), end_time = COALESCE(#{endTime}, end_time),"
        + " duration = COALESCE(#{duration}, duration), target_type = COALESCE(#{targetType}, target_type),"
        + " target_ids = COALESCE(#{targetIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler}, target_ids),"
        + " activation_mode = #{activationMode},"
        + " status = CASE WHEN #{activationMode} = 'always' THEN 'published' ELSE status END,"
        + " updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateUsage(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                    @Param("description") String description, @Param("startTime") OffsetDateTime startTime,
                    @Param("endTime") OffsetDateTime endTime, @Param("duration") Integer duration,
                    @Param("targetType") String targetType, @Param("targetIds") List<String> targetIds,
                    @Param("activationMode") String activationMode);

    /** 创建节点考试安排（start/end 传字符串，SQL 层 CAST timestamptz，对齐 Go CreateNodeUsage/CreateExamUsage）。 */
    @Insert("INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration,"
        + " target_type, target_ids, status, activation_mode, creator_id, exam_version)"
        + " VALUES (#{id}, #{tenantId}, #{examId}, #{name}, NULL,"
        + " CAST(NULLIF(#{startTime}, '') AS timestamptz), CAST(NULLIF(#{endTime}, '') AS timestamptz),"
        + " #{duration}, #{targetType},"
        + " #{targetIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{status}, #{activationMode}, #{creatorId}, #{examVersion})")
    int insertNodeUsage(@Param("id") String id, @Param("tenantId") String tenantId, @Param("examId") String examId,
                        @Param("name") String name, @Param("startTime") String startTime,
                        @Param("endTime") String endTime, @Param("duration") Integer duration,
                        @Param("targetType") String targetType, @Param("targetIds") List<String> targetIds,
                        @Param("status") String status, @Param("activationMode") String activationMode,
                        @Param("creatorId") String creatorId, @Param("examVersion") String examVersion);

    /** 更新安排开放时间窗/时长/启用条件（对齐 Go UpdateUsageWindow，direct SET 语义，限定租户）。 */
    @Update("UPDATE exam_usages SET start_time = CAST(NULLIF(#{startTime}, '') AS timestamptz),"
        + " end_time = CAST(NULLIF(#{endTime}, '') AS timestamptz), duration = #{duration},"
        + " activation_mode = #{activationMode},"
        + " status = CASE WHEN #{activationMode} = 'always' THEN 'published' ELSE status END,"
        + " updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateUsageWindow(@Param("id") String id, @Param("tenantId") String tenantId,
                          @Param("startTime") String startTime, @Param("endTime") String endTime,
                          @Param("duration") Integer duration, @Param("activationMode") String activationMode);

    /** 查询节点已有安排（对齐 Go FindNodeUsage）。 */
    @Select("SELECT id FROM exam_usages WHERE exam_id = #{examId}"
        + " AND target_type = 'node' AND #{nodeId} = ANY(target_ids) LIMIT 1")
    String selectNodeUsageId(@Param("examId") String examId, @Param("nodeId") String nodeId);

    /** 查询任务已有草稿安排（去重复用；对齐 Go createTempExamUsage 的 draft 分支）。 */
    @Select("SELECT id FROM exam_usages WHERE tenant_id = #{tenantId} AND exam_id = #{examId}"
        + " AND target_type = 'task' AND #{taskId} = ANY(target_ids) AND status = 'draft' LIMIT 1")
    String selectDraftTaskUsageId(@Param("tenantId") String tenantId, @Param("examId") String examId,
                                  @Param("taskId") String taskId);

    /** 数据库当前日期（YYYYMMDD；自动命名用，对齐 Go to_char(NOW(), 'YYYYMMDD')）。 */
    @Select("SELECT to_char(NOW(), 'YYYYMMDD')")
    String currentDateYmd();

    /** 同租户同目标类型当天已生成安排数（同天序号基数；对齐 Go NextAutoUsageName）。 */
    @Select("SELECT COUNT(*) FROM exam_usages WHERE tenant_id = #{tenantId} AND target_type = #{targetType}"
        + " AND created_at::date = CURRENT_DATE")
    int countUsagesCreatedToday(@Param("tenantId") String tenantId, @Param("targetType") String targetType);

    /** 批量查询节点已有安排（对齐 Go FindNodeUsages，防逐 examID 回查 N+1）。 */
    @Select("<script>SELECT exam_id AS exam_id, id AS id FROM exam_usages"
        + " WHERE target_type = 'node' AND #{nodeId} = ANY(target_ids) AND exam_id IN"
        + " <foreach collection='examIds' item='e' open='(' separator=',' close=')'>#{e}</foreach></script>")
    List<NodeUsageRow> selectNodeUsageRows(@Param("examIds") List<String> examIds, @Param("nodeId") String nodeId);

    /** 节点安排查询行。 */
    class NodeUsageRow {
        private String examId;
        private String id;

        public String getExamId() {
            return examId;
        }

        public void setExamId(String examId) {
            this.examId = examId;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }
    }

    /** 定时启停懒更新（对齐 Go SyncScheduledExamUsageStatus，读路径调用） */
    @Update("UPDATE exam_usages SET status = CASE"
        + " WHEN activation_mode = 'scheduled' AND status IN ('draft', 'published') AND end_time IS NOT NULL AND #{now} >= end_time THEN 'finished'"
        + " WHEN activation_mode = 'scheduled' AND status = 'draft' AND start_time IS NOT NULL AND #{now} >= start_time THEN 'published'"
        + " ELSE status END, updated_at = NOW()"
        + " WHERE activation_mode = 'scheduled' AND status IN ('draft', 'published')"
        + " AND (start_time IS NOT NULL AND #{now} >= start_time OR end_time IS NOT NULL AND #{now} >= end_time)"
        + " AND tenant_id = #{tenantId}")
    int syncScheduledExamUsageStatus(@Param("tenantId") String tenantId, @Param("now") OffsetDateTime now);

    @Update("UPDATE exam_usages SET status = #{status},"
        + " exam_version = CASE WHEN #{status} = 'published' THEN COALESCE("
        + " (SELECT rs.version FROM resource_snapshots rs"
        + "  WHERE rs.tenant_id = exam_usages.tenant_id AND rs.resource_type = 'exams' AND rs.resource_id = exam_usages.exam_id"
        + "  ORDER BY rs.created_at DESC, rs.id DESC LIMIT 1),"
        + " (SELECT e.version FROM exams e WHERE e.id = exam_usages.exam_id))"
        + " ELSE exam_version END, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int setStatus(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);

    /** 查询试卷租户（考试安排创建校验用） */
    @Select("SELECT tenant_id FROM exams WHERE id = #{examId}")
    String examTenantId(@Param("examId") String examId);

    /** 清理课程级旧测评（无结果的 exam_usages，对齐 Go CleanupCourseLevelAssessments） */
    @Delete("DELETE FROM exam_usages eu WHERE eu.target_type = 'course' AND #{courseId} = ANY(eu.target_ids)"
        + " AND NOT EXISTS (SELECT 1 FROM exam_results er WHERE er.exam_usage_id = eu.id)")
    int cleanupCourseLevelAssessments(@Param("courseId") String courseId);

    /** 查询试卷（租户限定，供 exam_version 解析） */
    @Select("SELECT COALESCE(version, '') FROM exams WHERE id = #{examId} AND tenant_id = #{tenantId}")
    String examVersion(@Param("examId") String examId, @Param("tenantId") String tenantId);

    /** 考试中心列表（对齐 Go ListExamCenter：手动安排 + 当前用户交卷状态） */
    @Select("<script>SELECT eu.id AS id, eu.exam_id AS exam_id, eu.name AS usage_name,"
        + " COALESCE(e.name, '') AS exam_name, COALESCE(e.description, '') AS description,"
        + " eu.start_time, eu.end_time, eu.duration, eu.status,"
        + " (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = eu.exam_id) AS question_count,"
        + " COALESCE(e.total_score, 0) AS total_score,"
        + " <if test='classNodeId != null and classNodeId != \"\"'>"
        + " COALESCE(eu.target_type &lt;&gt; 'class' OR #{classNodeId} = ANY(eu.target_ids), false) AS class_match,"
        + " </if>"
        + " <if test='classNodeId == null or classNodeId == \"\"'>"
        + " COALESCE(eu.target_type &lt;&gt; 'class', false) AS class_match,"
        + " </if>"
        + " (er.id IS NOT NULL) AS submitted, er.score, eu.exam_version"
        + " FROM exam_usages eu"
        + " JOIN exams e ON e.id = eu.exam_id"
        + " LEFT JOIN exam_results er ON er.exam_usage_id = eu.id AND er.user_id = #{userId}"
        + " WHERE eu.status IN ('published', 'finished')"
        + " AND eu.target_type IN ('class', 'major', 'department', 'public')"
        + " AND eu.tenant_id = #{tenantId}"
        + " ORDER BY eu.start_time ASC NULLS LAST LIMIT 100</script>")
    List<Map<String, Object>> selectExamCenter(@Param("tenantId") String tenantId, @Param("userId") String userId,
                                               @Param("classNodeId") String classNodeId);

    /** 学生班级组织节点（对齐 Go UserClassNodeID） */
    @Select("SELECT COALESCE(u.org_node_id, '') FROM users u WHERE u.id = #{userId}")
    String userClassNodeId(@Param("userId") String userId);
}
