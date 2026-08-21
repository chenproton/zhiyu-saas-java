package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationJobAbilityLog;
import org.dromara.zhiyu.domain.evaluation.EvaluationJobAbilityResult;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 岗位能力结果 Mapper（job_ability_results / job_ability_aggregate_logs 表）。
 *
 * @author zhiyu
 */
public interface EvaluationJobAbilityMapper extends BaseMapperPlus<EvaluationJobAbilityResult, EvaluationJobAbilityResult> {

    /** 学生所属院系 CTE（对齐 Go departmentNameSQL：沿组织树找"二级学院"类型节点） */
    String DEPARTMENT_JOIN = " LEFT JOIN LATERAL ("
        + " WITH RECURSIVE org_chain AS ("
        + "  SELECT o.id, o.type_id, o.parent_id, 0 AS depth FROM organizations o WHERE o.id = u.org_node_id"
        + "  UNION ALL"
        + "  SELECT o.id, o.type_id, o.parent_id, c.depth + 1 FROM organizations o"
        + "  JOIN org_chain c ON o.id = c.parent_id)"
        + " SELECT o.name AS dept_name FROM org_chain c"
        + " JOIN organizations o ON o.id = c.id"
        + " JOIN org_types t ON t.id = o.type_id AND t.tenant_id = o.tenant_id"
        + " WHERE t.name = '二级学院' ORDER BY c.depth LIMIT 1) dept ON true";

    String RESULT_COLUMNS = "r.id AS id, r.career_position_id AS career_position_id,"
        + " COALESCE(cp.name, '') AS position_name, r.user_id AS user_id, COALESCE(u.name, '') AS user_name,"
        + " COALESCE(u.student_no, u.username, u.login_name) AS student_no, r.class_name,"
        + " r.major_id AS major_id, r.major_name, COALESCE(dept.dept_name, '') AS department_name,"
        + " r.total_ability_points, r.achieved_ability_points, r.achievement_rate,"
        + " r.ability_cognition_score, r.position_competency, r.position_competency_v2, r.grade, r.evaluated_at,"
        + " r.ability_point_details AS ability_point_details, r.grade_history AS grade_history";

    /** 岗位能力结果分页查询（含学生/岗位/院系关联） */
    @Select("<script>SELECT " + RESULT_COLUMNS
        + " FROM job_ability_results r"
        + " LEFT JOIN users u ON u.id = r.user_id"
        + " LEFT JOIN career_positions cp ON cp.id = r.career_position_id"
        + DEPARTMENT_JOIN
        + " WHERE r.tenant_id = #{tenantId}"
        + " <if test='careerPositionId != null and careerPositionId != \"\"'>AND r.career_position_id = #{careerPositionId}</if>"
        + " <if test='userId != null and userId != \"\"'>AND r.user_id = #{userId}</if>"
        + " <if test='grade != null and grade != \"\"'>AND r.grade = #{grade}</if>"
        + " <if test='search != null and search != \"\"'>"
        + " AND (u.name LIKE #{search} OR COALESCE(u.student_no, u.username, u.login_name) LIKE #{search})</if>"
        + " ORDER BY r.evaluated_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<Map<String, Object>> selectResultPage(@Param("tenantId") String tenantId,
                                               @Param("careerPositionId") String careerPositionId,
                                               @Param("userId") String userId, @Param("grade") String grade,
                                               @Param("search") String search, @Param("limit") int limit,
                                               @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM job_ability_results r"
        + " LEFT JOIN users u ON u.id = r.user_id"
        + " WHERE r.tenant_id = #{tenantId}"
        + " <if test='careerPositionId != null and careerPositionId != \"\"'>AND r.career_position_id = #{careerPositionId}</if>"
        + " <if test='userId != null and userId != \"\"'>AND r.user_id = #{userId}</if>"
        + " <if test='grade != null and grade != \"\"'>AND r.grade = #{grade}</if>"
        + " <if test='search != null and search != \"\"'>"
        + " AND (u.name LIKE #{search} OR COALESCE(u.student_no, u.username, u.login_name) LIKE #{search})</if></script>")
    long countResultPage(@Param("tenantId") String tenantId, @Param("careerPositionId") String careerPositionId,
                         @Param("userId") String userId, @Param("grade") String grade, @Param("search") String search);

    /** 单个岗位能力结果（含关联） */
    @Select("SELECT " + RESULT_COLUMNS
        + " FROM job_ability_results r"
        + " LEFT JOIN users u ON u.id = r.user_id"
        + " LEFT JOIN career_positions cp ON cp.id = r.career_position_id"
        + DEPARTMENT_JOIN
        + " WHERE r.id = #{id} AND r.tenant_id = #{tenantId}")
    Map<String, Object> selectResultById(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 岗位能力汇总：以已发布认证规则岗位为基准左连接结果 */
    @Select("SELECT r.career_position_id AS position_id, COALESCE(cp.name, '') AS position_name,"
        + " COUNT(ja.id) AS student_count, COALESCE(AVG(ja.achievement_rate), 0) AS avg_rate"
        + " FROM certification_rules r"
        + " LEFT JOIN career_positions cp ON cp.id = r.career_position_id"
        + " LEFT JOIN job_ability_results ja ON ja.career_position_id = r.career_position_id AND ja.tenant_id = r.tenant_id"
        + " WHERE r.tenant_id = #{tenantId} AND r.status = 'published'"
        + " GROUP BY r.career_position_id, cp.name ORDER BY COUNT(ja.id) DESC")
    List<Map<String, Object>> summary(@Param("tenantId") String tenantId);

    /** 岗位能力结果 upsert（对齐 Go UpsertResult） */
    @Update("INSERT INTO job_ability_results (tenant_id, career_position_id, user_id, class_name, major_id, major_name,"
        + " total_ability_points, achieved_ability_points, achievement_rate, ability_cognition_score,"
        + " position_competency, position_competency_v2, grade, ability_point_details, evaluated_at)"
        + " VALUES (#{tenantId}, #{careerPositionId}, #{userId}, #{className}, #{majorId}, #{majorName},"
        + " #{totalAbilityPoints}, #{achievedAbilityPoints}, #{achievementRate}, #{abilityCognitionScore},"
        + " #{positionCompetency}, #{positionCompetencyV2}, #{grade}, #{abilityPointDetails}, NOW())"
        + " ON DUPLICATE KEY UPDATE"
        + " tenant_id = VALUES(tenant_id), class_name = VALUES(class_name), major_id = VALUES(major_id),"
        + " major_name = VALUES(major_name), total_ability_points = VALUES(total_ability_points),"
        + " achieved_ability_points = VALUES(achieved_ability_points), achievement_rate = VALUES(achievement_rate),"
        + " ability_cognition_score = VALUES(ability_cognition_score), position_competency = VALUES(position_competency),"
        + " position_competency_v2 = VALUES(position_competency_v2), grade = VALUES(grade),"
        + " ability_point_details = VALUES(ability_point_details), evaluated_at = VALUES(evaluated_at)")
    int upsertResult(@Param("tenantId") String tenantId, @Param("careerPositionId") String careerPositionId,
                     @Param("userId") String userId, @Param("className") String className,
                     @Param("majorId") String majorId, @Param("majorName") String majorName,
                     @Param("totalAbilityPoints") Integer totalAbilityPoints,
                     @Param("achievedAbilityPoints") Integer achievedAbilityPoints,
                     @Param("achievementRate") BigDecimal achievementRate,
                     @Param("abilityCognitionScore") BigDecimal abilityCognitionScore,
                     @Param("positionCompetency") BigDecimal positionCompetency,
                     @Param("positionCompetencyV2") BigDecimal positionCompetencyV2,
                     @Param("grade") String grade, @Param("abilityPointDetails") String abilityPointDetails);

    // ---------- 汇聚日志 ----------

    /**
     * 解除当前事务的语句超时（汇聚 SQL 可能超过全局 15s；SET LOCAL 仅当前事务有效，
     * 事务结束自动恢复，对齐 Go aggregateAll 专用连接 SET statement_timeout = 0）。
     * 必须在事务内调用（无事务时 PG 报 WARNING 且不生效）。
     */
    @Update("SET LOCAL statement_timeout = 0")
    int disableStatementTimeout();

    @Insert("INSERT INTO job_ability_aggregate_logs (tenant_id, career_position_id, status)"
        + " VALUES (#{tenantId}, #{careerPositionId}, 'running') RETURNING id")
    String createAggregateLog(@Param("tenantId") String tenantId, @Param("careerPositionId") String careerPositionId);

    @Update("UPDATE job_ability_aggregate_logs SET status = #{status}, student_count = #{studentCount},"
        + " updated_count = #{updatedCount}, error_message = #{errorMessage}, finished_at = NOW()"
        + " WHERE id = #{logId}")
    int finishAggregateLog(@Param("logId") String logId, @Param("status") String status,
                           @Param("studentCount") Integer studentCount, @Param("updatedCount") Integer updatedCount,
                           @Param("errorMessage") String errorMessage);

    @Select("SELECT id AS id, career_position_id AS career_position_id, status, student_count,"
        + " updated_count, error_message, started_at, finished_at"
        + " FROM job_ability_aggregate_logs WHERE id = #{logId} AND tenant_id = #{tenantId}")
    Map<String, Object> aggregateLogById(@Param("logId") String logId, @Param("tenantId") String tenantId);

    @Select("SELECT id AS id, career_position_id AS career_position_id, status, student_count,"
        + " updated_count, error_message, started_at, finished_at"
        + " FROM job_ability_aggregate_logs"
        + " WHERE tenant_id = #{tenantId} AND career_position_id = #{positionId}"
        + " AND started_at > NOW() - INTERVAL '1 hour' ORDER BY started_at DESC LIMIT 1")
    Map<String, Object> recentAggregateLog(@Param("tenantId") String tenantId, @Param("positionId") String positionId);

    /** 任务集合下所有已评价学生（去重，候选学生） */
    @Select("<script>SELECT evaluatee_id AS evaluatee_id FROM scene_evaluation_results"
        + " WHERE tenant_id = #{tenantId} AND task_id IN"
        + " <foreach collection='taskIds' item='taskId' open='(' separator=',' close=')'>#{taskId}</foreach>"
        + " AND status = 'evaluated'"
        + " UNION SELECT evaluatee_id FROM course_evaluation_results"
        + " WHERE tenant_id = #{tenantId} AND course_id IN"
        + " <foreach collection='taskIds' item='taskId' open='(' separator=',' close=')'>#{taskId}</foreach>"
        + " AND status = 'evaluated'"
        + " UNION SELECT ner.evaluatee_id FROM node_evaluation_results ner"
        + " JOIN system_course_nodes n ON n.id = ner.node_id"
        + " WHERE ner.tenant_id = #{tenantId} AND n.course_id IN"
        + " <foreach collection='taskIds' item='taskId' open='(' separator=',' close=')'>#{taskId}</foreach>"
        + " AND ner.status = 'evaluated'</script>")
    List<String> listCandidateStudents(@Param("tenantId") String tenantId, @Param("taskIds") List<String> taskIds);

    /** 加载学生任务归一化最高得分（0-100） */
    @Select("<script>SELECT evaluatee_id AS student_id, task_id AS task_id, MAX(score) AS score FROM ("
        + " SELECT evaluatee_id, task_id, total_score / NULLIF(max_score, 0) * 100 AS score"
        + "  FROM scene_evaluation_results"
        + "  WHERE tenant_id = #{tenantId} AND task_id IN"
        + "  <foreach collection='taskIds' item='taskId' open='(' separator=',' close=')'>#{taskId}</foreach>"
        + "  AND evaluatee_id IN"
        + "  <foreach collection='studentIds' item='studentId' open='(' separator=',' close=')'>#{studentId}</foreach>"
        + "  AND total_score IS NOT NULL AND status = 'evaluated'"
        + " UNION ALL"
        + " SELECT evaluatee_id, course_id AS task_id, total_score / NULLIF(max_score, 0) * 100 AS score"
        + "  FROM course_evaluation_results"
        + "  WHERE tenant_id = #{tenantId} AND course_id IN"
        + "  <foreach collection='taskIds' item='taskId' open='(' separator=',' close=')'>#{taskId}</foreach>"
        + "  AND evaluatee_id IN"
        + "  <foreach collection='studentIds' item='studentId' open='(' separator=',' close=')'>#{studentId}</foreach>"
        + "  AND total_score IS NOT NULL AND status = 'evaluated'"
        + " UNION ALL"
        + " SELECT ner.evaluatee_id, n.course_id AS task_id, ner.total_score / NULLIF(ner.max_score, 0) * 100 AS score"
        + "  FROM node_evaluation_results ner JOIN system_course_nodes n ON n.id = ner.node_id"
        + "  WHERE ner.tenant_id = #{tenantId} AND n.course_id IN"
        + "  <foreach collection='taskIds' item='taskId' open='(' separator=',' close=')'>#{taskId}</foreach>"
        + "  AND ner.evaluatee_id IN"
        + "  <foreach collection='studentIds' item='studentId' open='(' separator=',' close=')'>#{studentId}</foreach>"
        + "  AND ner.total_score IS NOT NULL AND ner.status = 'evaluated'"
        + " ) t GROUP BY evaluatee_id, task_id</script>")
    List<Map<String, Object>> loadStudentTaskScores(@Param("tenantId") String tenantId,
                                                    @Param("taskIds") List<String> taskIds,
                                                    @Param("studentIds") List<String> studentIds);

    /** 按岗位刷新画像排名（class/major 排名） */
    @Update("WITH ranked AS ("
        + " SELECT user_id, RANK() OVER (PARTITION BY class_name ORDER BY achievement_rate DESC) AS class_rank,"
        + " COUNT(*) OVER (PARTITION BY class_name) AS class_total,"
        + " RANK() OVER (PARTITION BY major_id ORDER BY achievement_rate DESC) AS major_rank,"
        + " COUNT(*) OVER (PARTITION BY major_id) AS major_total"
        + " FROM job_ability_results WHERE career_position_id = #{positionId} AND tenant_id = #{tenantId})"
        + " UPDATE student_ability_portraits p SET class_rank = r.class_rank, class_total = r.class_total,"
        + " major_rank = r.major_rank, major_total = r.major_total, updated_at = NOW()"
        + " FROM ranked r WHERE p.career_position_id = #{positionId} AND p.user_id = r.user_id"
        + " AND p.tenant_id = #{tenantId}")
    int refreshRanks(@Param("positionId") String positionId, @Param("tenantId") String tenantId);

    /** 学生所在班级已排课的已发布课程（学生课程成绩/画像课程表用） */
    @Select("<script>SELECT DISTINCT c.id AS id, c.name"
        + " FROM courses c JOIN schedule_entries se ON se.course_id = c.id"
        + " WHERE c.tenant_id = #{tenantId} AND c.status = 'published' AND se.status = 'published'"
        + " AND se.type = 'traditional' AND (se.class_node_id = #{orgNodeId} OR #{orgNodeId} = ANY(se.class_node_ids))"
        + " ORDER BY c.name</script>")
    List<Map<String, Object>> listStudentCourses(@Param("tenantId") String tenantId, @Param("orgNodeId") String orgNodeId);

    /** 学生课程成绩与排名（对齐 Go ListStudentCourseScores） */
    @Select("WITH student_courses AS ("
        + " SELECT DISTINCT n.course_id FROM node_evaluation_results ner"
        + " JOIN system_course_nodes n ON n.id = ner.node_id"
        + " WHERE ner.tenant_id = #{tenantId} AND ner.status = 'evaluated' AND ner.total_score IS NOT NULL"
        + " AND ner.evaluatee_id = #{userId}),"
        + " course_avg AS ("
        + " SELECT n.course_id, ner.evaluatee_id, AVG(ner.total_score / NULLIF(ner.max_score, 0) * 100) AS score"
        + " FROM node_evaluation_results ner JOIN system_course_nodes n ON n.id = ner.node_id"
        + " JOIN student_courses sc ON sc.course_id = n.course_id"
        + " WHERE ner.tenant_id = #{tenantId} AND ner.status = 'evaluated' AND ner.total_score IS NOT NULL"
        + " GROUP BY n.course_id, ner.evaluatee_id)"
        + " SELECT ca.course_id AS course_id, COALESCE(c.name, '') AS course_name, ca.score,"
        + " RANK() OVER (PARTITION BY ca.course_id ORDER BY ca.score DESC) AS rank,"
        + " COUNT(*) OVER (PARTITION BY ca.course_id) AS total"
        + " FROM course_avg ca LEFT JOIN courses c ON c.id = ca.course_id JOIN users st ON st.id = #{userId}"
        + " WHERE ca.evaluatee_id = #{userId}"
        + " AND EXISTS (SELECT 1 FROM schedule_entries se"
        + "  WHERE se.course_id = ca.course_id AND se.status = 'published' AND se.type = 'traditional'"
        + "  AND (se.class_node_id = st.org_node_id OR st.org_node_id = ANY(se.class_node_ids)))"
        + " ORDER BY ca.score DESC")
    List<Map<String, Object>> listStudentCourseScores(@Param("tenantId") String tenantId, @Param("userId") String userId);

    /** 学生有已评评分记录的去重场景数 */
    @Select("SELECT COUNT(DISTINCT ser.scene_id) FROM scene_evaluation_results ser"
        + " WHERE ser.tenant_id = #{tenantId} AND ser.evaluatee_id = #{userId} AND ser.status = 'evaluated'"
        + " AND ser.scene_id IS NOT NULL")
    int countStudentScenes(@Param("tenantId") String tenantId, @Param("userId") String userId);

    /** 学生班级已排课场景关联的岗位（去重） */
    @Select("SELECT DISTINCT s.career_position_id AS position_id, COALESCE(cp.name, '') AS name"
        + " FROM schedule_entries se"
        + " JOIN scenarios s ON s.id = se.scenario_id AND s.tenant_id = #{tenantId}"
        + " LEFT JOIN career_positions cp ON cp.id = s.career_position_id"
        + " WHERE se.status = 'published' AND se.type = 'traditional'"
        + " AND (se.class_node_id = #{orgNodeId} OR #{orgNodeId} = ANY(se.class_node_ids))"
        + " AND s.career_position_id IS NOT NULL")
    List<Map<String, Object>> listScenePositions(@Param("tenantId") String tenantId, @Param("orgNodeId") String orgNodeId);
}
