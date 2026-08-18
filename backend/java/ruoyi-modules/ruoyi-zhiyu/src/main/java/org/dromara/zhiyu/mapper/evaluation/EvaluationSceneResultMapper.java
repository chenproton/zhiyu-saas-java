package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationSceneResult;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 场景测评结果 Mapper（scene_evaluation_results 表）。
 *
 * @author zhiyu
 */
public interface EvaluationSceneResultMapper extends BaseMapperPlus<EvaluationSceneResult, EvaluationSceneResult> {

    /** 评分（pending→evaluated，限定租户，纵深防御） */
    @Update("UPDATE scene_evaluation_results SET total_score = #{score}, comment = #{comment},"
        + " eval_point_scores = #{evalPointScores}, drawn_questions = #{drawnQuestions},"
        + " subjective_content = #{subjectiveContent}, status = 'evaluated', graded_at = NOW(),"
        + " graded_by = #{graderId}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = 'pending'")
    int grade(@Param("id") String id, @Param("tenantId") String tenantId, @Param("graderId") String graderId,
              @Param("score") BigDecimal score, @Param("comment") String comment,
              @Param("evalPointScores") String evalPointScores, @Param("drawnQuestions") String drawnQuestions,
              @Param("subjectiveContent") String subjectiveContent);

    /** 场景任务反查场景 ID（提交时服务端盖章） */
    @Select("SELECT scenario_id::text FROM scenario_tasks WHERE id = #{taskId}::uuid")
    String scenarioIdByTask(@Param("taskId") String taskId);

    /** 反向回写链：按 usageId 定位考试结果 */
    @Select("SELECT er.id::text FROM exam_results er"
        + " WHERE er.exam_usage_id = #{usageId}::uuid AND er.user_id = #{userId}::uuid"
        + " ORDER BY er.submit_time DESC NULLS LAST, er.created_at DESC LIMIT 1")
    String findExamResultByUsage(@Param("usageId") String usageId, @Param("userId") String userId);

    /** 反向回写链：按 paperId/examId + 任务目标定位考试结果 */
    @Select("SELECT er.id::text FROM exam_results er JOIN exam_usages eu ON er.exam_usage_id = eu.id"
        + " WHERE eu.target_type = 'task' AND #{taskId}::uuid = ANY(eu.target_ids) AND eu.exam_id = #{examId}::uuid"
        + " AND er.user_id = #{userId}::uuid"
        + " ORDER BY er.submit_time DESC NULLS LAST, er.created_at DESC LIMIT 1")
    String findExamResultByExam(@Param("taskId") String taskId, @Param("examId") String examId,
                                @Param("userId") String userId);

    /** 更新考试结果分数（同步及格判定与 graded_at 重交保护） */
    @Update("UPDATE exam_results SET score = #{score}, is_pass = (#{score} >= total_score * 0.6),"
        + " graded_at = NOW(), updated_at = NOW() WHERE id = #{examResultId}::uuid")
    int updateExamResultScore(@Param("examResultId") String examResultId, @Param("score") BigDecimal score);

    /** 批量查询评分目标（task/method/evaluatee） */
    @Select("<script>SELECT id::text AS id, task_id::text AS task_id, method_key, evaluatee_id::text AS evaluatee_id"
        + " FROM scene_evaluation_results WHERE id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}::uuid</foreach></script>")
    List<Map<String, Object>> batchGetGradeTargets(@Param("ids") List<String> ids);

    /** 场景快照数据（评分回写按成绩行盖章版本定位） */
    @Select("SELECT snapshot_data FROM resource_snapshots"
        + " WHERE tenant_id = #{tenantId}::uuid AND resource_type = 'scenarios' AND resource_id = #{sceneId}::uuid AND version = #{version}")
    String scenarioSnapshotData(@Param("tenantId") String tenantId, @Param("sceneId") String sceneId,
                                @Param("version") String version);

    /** 提交评价结果（幂等 upsert；已评分行禁止重交覆盖，返回影响行数） */
    @Insert("INSERT INTO scene_evaluation_results (tenant_id, task_id, scene_id, method_key, evaluatee_id,"
        + " evaluator_id, evaluator_type, status, max_score, eval_point_scores, objective_answers,"
        + " subjective_content, drawn_questions, version, created_at, updated_at)"
        + " VALUES (#{tenantId}, #{taskId}, #{sceneId}, #{methodKey}, #{evaluateeId}, #{evaluatorId},"
        + " #{evaluatorType}, 'pending', #{maxScore}, #{evalPointScores}, #{objectiveAnswers},"
        + " #{subjectiveContent}, #{drawnQuestions}, #{version}, NOW(), NOW())"
        + " ON CONFLICT (tenant_id, task_id, evaluatee_id, method_key) DO UPDATE SET"
        + " scene_id = EXCLUDED.scene_id, evaluator_id = EXCLUDED.evaluator_id, evaluator_type = EXCLUDED.evaluator_type,"
        + " max_score = EXCLUDED.max_score, objective_answers = EXCLUDED.objective_answers,"
        + " subjective_content = EXCLUDED.subjective_content, drawn_questions = EXCLUDED.drawn_questions,"
        + " eval_point_scores = EXCLUDED.eval_point_scores, version = EXCLUDED.version,"
        + " status = 'pending', graded_at = NULL, updated_at = EXCLUDED.updated_at"
        + " WHERE scene_evaluation_results.graded_at IS NULL")
    int upsertSubmit(EvaluationSceneResult entity);

    /** live JOIN 回退定位考试结果（对齐 Go FindLatestExamResult） */
    @Select("SELECT er.id::text FROM exam_results er"
        + " JOIN exam_usages eu ON er.exam_usage_id = eu.id"
        + " JOIN task_evaluation_methods tem ON tem.task_id = ANY(eu.target_ids)"
        + " WHERE tem.task_id = #{taskId}::uuid AND tem.method_key = #{methodKey}"
        + " AND er.user_id = #{evaluateeId}::uuid AND eu.target_type = 'task'"
        + " AND eu.exam_id = COALESCE(NULLIF(tem.resource_config->>'paperId', ''),"
        + " NULLIF(tem.resource_config->>'examId', ''))::uuid"
        + " ORDER BY er.submit_time DESC NULLS LAST, er.created_at DESC LIMIT 1")
    String findLatestExamResult(@Param("taskId") String taskId, @Param("methodKey") String methodKey,
                                @Param("evaluateeId") String evaluateeId);
}
