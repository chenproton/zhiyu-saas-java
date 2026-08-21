package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationExamResult;

import java.util.List;
import java.util.Map;

/**
 * 考试成绩 Mapper（exam_results 表）。
 *
 * @author zhiyu
 */
public interface EvaluationExamResultMapper extends BaseMapperPlus<EvaluationExamResult, EvaluationExamResult> {

    /** 批量查询专业名称（key=major_id，value=name） */
    @Select("<script>SELECT id, name FROM majors WHERE id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></script>")
    List<Map<String, Object>> selectMajorNames(@Param("ids") List<String> ids);

    /** 是否已提交（重复作答控制） */
    @Select("SELECT EXISTS(SELECT 1 FROM exam_results WHERE exam_usage_id = #{usageId} AND user_id = #{userId})")
    boolean resultSubmitted(@Param("usageId") String usageId, @Param("userId") String userId);

    /** 教师是否已评分（重交保护） */
    @Select("SELECT EXISTS(SELECT 1 FROM exam_results WHERE exam_usage_id = #{usageId} AND user_id = #{userId} AND graded_at IS NOT NULL)")
    boolean resultTeacherGraded(@Param("usageId") String usageId, @Param("userId") String userId);

    /** 考试安排目标（班级可参加校验；unnest → JSON_TABLE） */
    @Select("SELECT eu.target_type AS target_type, COALESCE(JSON_ARRAYAGG(jt.x), JSON_ARRAY()) AS target_ids"
        + " FROM exam_usages eu"
        + " JOIN JSON_TABLE(eu.target_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + " WHERE eu.id = #{usageId} GROUP BY eu.target_type")
    Map<String, Object> usageTarget(@Param("usageId") String usageId);

    /** 考试安排绑定的试卷与固化版本 */
    @Select("SELECT exam_id AS exam_id, COALESCE(exam_version, '') AS exam_version"
        + " FROM exam_usages WHERE id = #{usageId} AND status != 'draft'")
    Map<String, Object> usageExamRef(@Param("usageId") String usageId);

    /** 学生用户档案（姓名/班级/专业） */
    @Select("SELECT COALESCE(u.name, '') AS name, COALESCE(o.name, '') AS class_name,"
        + " COALESCE(m.name, '') AS major_name, u.major_id AS major_id"
        + " FROM users u LEFT JOIN organizations o ON o.id = u.org_node_id"
        + " LEFT JOIN majors m ON m.id = u.major_id WHERE u.id = #{userId}")
    Map<String, Object> fetchUserProfile(@Param("userId") String userId);

    /** live 总分：exams.total_score 缺省回退 SUM(exam_questions.score) */
    @Select("SELECT COALESCE(NULLIF((SELECT total_score FROM exams WHERE id = #{examId}), 0),"
        + " (SELECT COALESCE(SUM(score), 0) FROM exam_questions WHERE exam_id = #{examId}))")
    java.math.BigDecimal liveExamTotalScore(@Param("examId") String examId);

    /** 学生班级是否命中考试安排目标班级（对齐 Go UsageTarget class 校验） */
    @Select("SELECT EXISTS(SELECT 1 FROM exam_usages WHERE id = #{usageId} AND JSON_CONTAINS(target_ids, JSON_QUOTE(#{classNodeId}), '$'))")
    boolean classTargetContains(@Param("usageId") String usageId, @Param("classNodeId") String classNodeId);

    /** 任务测评方式是否已由教师评分（重交保护；对齐 Go UsageGradedByUser） */
    @Select("SELECT EXISTS("
        + " SELECT 1 FROM exam_usages eu"
        + " JOIN task_evaluation_methods tem ON JSON_CONTAINS(eu.target_ids, JSON_QUOTE(tem.task_id), '$') AND tem.method_key = #{methodKey}"
        + "  AND eu.exam_id = COALESCE(NULLIF(tem.resource_config->>'$.paperId', ''), NULLIF(tem.resource_config->>'$.examId', ''))"
        + " JOIN scene_evaluation_results ser ON ser.task_id = tem.task_id AND ser.evaluatee_id = #{userId}"
        + "  AND ser.method_key = #{methodKey}"
        + " WHERE eu.id = #{usageId} AND ser.status = 'evaluated' AND ser.graded_at IS NOT NULL)")
    boolean usageGradedByUser(@Param("usageId") String usageId, @Param("userId") String userId,
                              @Param("methodKey") String methodKey);

    /** 考试安排是否允许重复作答（对齐 Go UsageAllowRetake，任务目标主路径） */
    @Select("SELECT COALESCE("
        + " (SELECT (tem.resource_config->>'$.allowRetake')"
        + "  FROM exam_usages eu"
        + "  JOIN task_evaluation_methods tem ON JSON_CONTAINS(eu.target_ids, JSON_QUOTE(tem.task_id), '$')"
        + "   AND eu.exam_id = COALESCE(NULLIF(tem.resource_config->>'$.paperId', ''), NULLIF(tem.resource_config->>'$.examId', ''))"
        + "  WHERE eu.id = #{usageId} AND eu.target_type = 'task' AND tem.resource_config->>'$.allowRetake' IS NOT NULL"
        + "  LIMIT 1), false)")
    boolean usageAllowRetake(@Param("usageId") String usageId);

    /** 教师评分（限定租户，纵深防御） */
    @Update("UPDATE exam_results SET score = #{score}, is_pass = #{isPass}, grading_status = 'evaluated',"
        + " grading_scores = #{gradingScores}, grading_comment = #{comment}, grader_id = #{graderId},"
        + " graded_at = NOW(), updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int grade(@Param("id") String id, @Param("tenantId") String tenantId, @Param("graderId") String graderId,
              @Param("score") java.math.BigDecimal score, @Param("isPass") Boolean isPass,
              @Param("gradingScores") String gradingScores, @Param("comment") String comment);

    /** 保存考试结果（幂等 upsert，已评分行禁止覆盖；version 盖章取安排 exam_version） */
    @org.apache.ibatis.annotations.Insert("INSERT INTO exam_results (tenant_id, exam_usage_id, user_id, student_name,"
        + " class_name, grade, major_id, score, total_score, is_pass, answers, grading_status, version)"
        + " VALUES (#{tenantId}, #{usageId}, #{userId}, #{studentName}, #{className}, #{grade}, #{majorId},"
        + " #{score}, #{totalScore}, #{isPass}, #{answers}, #{gradingStatus},"
        + " (SELECT exam_version FROM exam_usages WHERE id = #{usageId}))"
        + " ON DUPLICATE KEY UPDATE"
        + " score = IF(exam_results.graded_at IS NULL, VALUES(score), score),"
        + " total_score = IF(exam_results.graded_at IS NULL, VALUES(total_score), total_score),"
        + " is_pass = IF(exam_results.graded_at IS NULL, VALUES(is_pass), is_pass),"
        + " answers = IF(exam_results.graded_at IS NULL, VALUES(answers), answers),"
        + " grading_status = IF(exam_results.graded_at IS NULL, VALUES(grading_status), grading_status),"
        + " version = IF(exam_results.graded_at IS NULL, VALUES(version), version),"
        + " submit_time = IF(exam_results.graded_at IS NULL, NOW(), submit_time)")
    int saveResult(@Param("tenantId") String tenantId, @Param("usageId") String usageId, @Param("userId") String userId,
                   @Param("studentName") String studentName, @Param("className") String className,
                   @Param("grade") String grade, @Param("majorId") String majorId,
                   @Param("score") java.math.BigDecimal score, @Param("totalScore") java.math.BigDecimal totalScore,
                   @Param("isPass") Boolean isPass, @Param("answers") String answers,
                   @Param("gradingStatus") String gradingStatus);

    /** 同步场景统一评价（考试目标为任务时；对齐 Go SyncSceneEvaluation） */
    @org.apache.ibatis.annotations.Insert("INSERT INTO scene_evaluation_results (tenant_id, task_id, scene_id, method_key,"
        + " evaluatee_id, status, total_score, max_score, objective_answers, version)"
        + " SELECT #{tenantId}, tem.task_id, st.scenario_id, tem.method_key, #{userId}, #{status}, #{score}, #{maxScore},"
        + " #{objectiveAnswers}, (SELECT exam_version FROM exam_usages WHERE id = #{usageId})"
        + " FROM exam_usages eu"
        + " JOIN task_evaluation_methods tem ON JSON_CONTAINS(eu.target_ids, JSON_QUOTE(tem.task_id), '$')"
        + " JOIN scenario_tasks st ON st.id = tem.task_id"
        + " WHERE eu.id = #{usageId} AND tem.method_key = #{methodKey}"
        + " ON DUPLICATE KEY UPDATE"
        + " total_score = CASE WHEN scene_evaluation_results.status = 'evaluated' THEN scene_evaluation_results.total_score ELSE VALUES(total_score) END,"
        + " max_score = VALUES(max_score),"
        + " status = CASE WHEN scene_evaluation_results.status = 'evaluated' THEN 'evaluated' ELSE VALUES(status) END,"
        + " objective_answers = VALUES(objective_answers),"
        + " version = CASE WHEN scene_evaluation_results.status = 'evaluated' THEN scene_evaluation_results.version ELSE VALUES(version) END,"
        + " graded_at = CASE WHEN scene_evaluation_results.status = 'evaluated' THEN scene_evaluation_results.graded_at"
        + "  WHEN VALUES(status) = 'evaluated' THEN NOW() ELSE NULL END,"
        + " updated_at = NOW()")
    int syncSceneEvaluation(@Param("tenantId") String tenantId, @Param("usageId") String usageId,
                            @Param("userId") String userId, @Param("score") java.math.BigDecimal score,
                            @Param("maxScore") java.math.BigDecimal maxScore,
                            @Param("objectiveAnswers") String objectiveAnswers, @Param("status") String status,
                            @Param("methodKey") String methodKey);

    /** 同步课程统一评价（考试目标为课程时；对齐 Go SyncCourseEvaluation） */
    @org.apache.ibatis.annotations.Insert("INSERT INTO course_evaluation_results (tenant_id, course_id, method_key,"
        + " evaluatee_id, status, total_score, max_score, objective_answers, version)"
        + " SELECT #{tenantId}, JSON_UNQUOTE(JSON_EXTRACT(eu.target_ids, '$[0]')), COALESCE(NULLIF(#{methodKey}, ''), 'paper'), #{userId}, #{status},"
        + " #{score}, #{maxScore}, #{objectiveAnswers}, (SELECT exam_version FROM exam_usages WHERE id = #{usageId})"
        + " FROM exam_usages eu WHERE eu.id = #{usageId} AND eu.target_type = 'course' AND JSON_LENGTH(eu.target_ids) > 0"
        + " ON DUPLICATE KEY UPDATE"
        + " total_score = CASE WHEN course_evaluation_results.status = 'evaluated' THEN course_evaluation_results.total_score ELSE VALUES(total_score) END,"
        + " max_score = VALUES(max_score),"
        + " status = CASE WHEN course_evaluation_results.status = 'evaluated' THEN 'evaluated' ELSE VALUES(status) END,"
        + " objective_answers = VALUES(objective_answers),"
        + " version = CASE WHEN course_evaluation_results.status = 'evaluated' THEN course_evaluation_results.version ELSE VALUES(version) END,"
        + " graded_at = CASE WHEN course_evaluation_results.status = 'evaluated' THEN course_evaluation_results.graded_at"
        + "  WHEN VALUES(status) = 'evaluated' THEN NOW() ELSE NULL END,"
        + " updated_at = NOW()")
    int syncCourseEvaluation(@Param("tenantId") String tenantId, @Param("usageId") String usageId,
                             @Param("userId") String userId, @Param("score") java.math.BigDecimal score,
                             @Param("maxScore") java.math.BigDecimal maxScore,
                             @Param("objectiveAnswers") String objectiveAnswers, @Param("status") String status,
                             @Param("methodKey") String methodKey);

    /** 同步节点统一评价（考试目标为节点时；对齐 Go SyncNodeEvaluation） */
    @org.apache.ibatis.annotations.Insert("INSERT INTO node_evaluation_results (tenant_id, node_id, method_key,"
        + " evaluatee_id, status, total_score, max_score, objective_answers, version)"
        + " SELECT #{tenantId}, JSON_UNQUOTE(JSON_EXTRACT(eu.target_ids, '$[0]')), COALESCE(NULLIF(#{methodKey}, ''), 'paper'), #{userId}, #{status},"
        + " #{score}, #{maxScore}, #{objectiveAnswers}, (SELECT exam_version FROM exam_usages WHERE id = #{usageId})"
        + " FROM exam_usages eu WHERE eu.id = #{usageId} AND eu.target_type = 'node' AND JSON_LENGTH(eu.target_ids) > 0"
        + " ON DUPLICATE KEY UPDATE"
        + " total_score = CASE WHEN node_evaluation_results.status = 'evaluated' THEN node_evaluation_results.total_score ELSE VALUES(total_score) END,"
        + " max_score = VALUES(max_score),"
        + " status = CASE WHEN node_evaluation_results.status = 'evaluated' THEN 'evaluated' ELSE VALUES(status) END,"
        + " objective_answers = VALUES(objective_answers),"
        + " version = CASE WHEN node_evaluation_results.status = 'evaluated' THEN node_evaluation_results.version ELSE VALUES(version) END,"
        + " graded_at = CASE WHEN node_evaluation_results.status = 'evaluated' THEN node_evaluation_results.graded_at"
        + "  WHEN VALUES(status) = 'evaluated' THEN NOW() ELSE NULL END,"
        + " updated_at = NOW()")
    int syncNodeEvaluation(@Param("tenantId") String tenantId, @Param("usageId") String usageId,
                           @Param("userId") String userId, @Param("score") java.math.BigDecimal score,
                           @Param("maxScore") java.math.BigDecimal maxScore,
                           @Param("objectiveAnswers") String objectiveAnswers, @Param("status") String status,
                           @Param("methodKey") String methodKey);

    /** 考试题目答案、选项与分数（判分数据，按 sort_order；选项用于字母答案归一化判分） */
    @Select("SELECT id AS id, type, answer, score, COALESCE(options, '[]') AS options FROM exam_questions"
        + " WHERE exam_id = #{examId} ORDER BY sort_order")
    java.util.List<java.util.Map<String, Object>> fetchExamQuestions(@Param("examId") String examId);
}
