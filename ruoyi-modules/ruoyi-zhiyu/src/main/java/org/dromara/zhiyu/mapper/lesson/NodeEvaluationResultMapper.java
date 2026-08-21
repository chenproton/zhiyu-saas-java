package org.dromara.zhiyu.mapper.lesson;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.lesson.NodeEvaluationResult;

import java.math.BigDecimal;
import java.util.List;

/**
 * 节点测评结果 Mapper（node_evaluation_results 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface NodeEvaluationResultMapper extends BaseMapperPlus<NodeEvaluationResult, NodeEvaluationResult> {

    String SELECT_COLUMNS = "id, node_id, method_key, evaluatee_id, evaluator_id, evaluator_type, status,"
        + " total_score, max_score, eval_point_scores AS eval_point_scores,"
        + " objective_answers AS objective_answers, subjective_content AS subjective_content,"
        + " drawn_questions AS drawn_questions, comment, graded_at, graded_by, version, created_at, updated_at";

    /** 查询单条（限定租户）。 */
    @Select("SELECT " + SELECT_COLUMNS + " FROM node_evaluation_results WHERE id = #{id} AND tenant_id = #{tenantId}")
    NodeEvaluationResult selectOwned(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 查询测评结果租户（归属校验用）。 */
    @Select("SELECT tenant_id FROM node_evaluation_results WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    /**
     * 提交（幂等 upsert）：已评分的结果禁止重交覆盖（IF 守卫保持已评分行原值，对齐 PG
     * ON CONFLICT DO UPDATE ... WHERE graded_at IS NULL）。
     */
    @Insert("INSERT INTO node_evaluation_results (tenant_id, node_id, method_key, evaluatee_id, evaluator_id,"
        + " evaluator_type, status, max_score, eval_point_scores, objective_answers, subjective_content,"
        + " drawn_questions, version, created_at, updated_at)"
        + " VALUES (#{tenantId}, #{nodeId}, #{methodKey}, #{evaluateeId}, #{evaluatorId}, #{evaluatorType},"
        + " 'pending', #{maxScore}, CAST(#{evalPointScores} AS JSON), CAST(#{objectiveAnswers} AS JSON),"
        + " CAST(#{subjectiveContent} AS JSON), CAST(#{drawnQuestions} AS JSON), #{version}, NOW(), NOW())"
        + " ON DUPLICATE KEY UPDATE"
        + " evaluator_id = IF(graded_at IS NULL, VALUES(evaluator_id), evaluator_id),"
        + " evaluator_type = IF(graded_at IS NULL, VALUES(evaluator_type), evaluator_type),"
        + " max_score = IF(graded_at IS NULL, VALUES(max_score), max_score),"
        + " objective_answers = IF(graded_at IS NULL, VALUES(objective_answers), objective_answers),"
        + " subjective_content = IF(graded_at IS NULL, VALUES(subjective_content), subjective_content),"
        + " drawn_questions = IF(graded_at IS NULL, VALUES(drawn_questions), drawn_questions),"
        + " eval_point_scores = IF(graded_at IS NULL, VALUES(eval_point_scores), eval_point_scores),"
        + " version = IF(graded_at IS NULL, VALUES(version), version),"
        + " status = IF(graded_at IS NULL, 'pending', status),"
        + " graded_at = IF(graded_at IS NULL, NULL, graded_at),"
        + " updated_at = IF(graded_at IS NULL, VALUES(updated_at), updated_at)")
    int upsertResult(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                     @Param("methodKey") String methodKey, @Param("evaluateeId") String evaluateeId,
                     @Param("evaluatorId") String evaluatorId, @Param("evaluatorType") String evaluatorType,
                     @Param("maxScore") BigDecimal maxScore, @Param("evalPointScores") String evalPointScores,
                     @Param("objectiveAnswers") String objectiveAnswers,
                     @Param("subjectiveContent") String subjectiveContent,
                     @Param("drawnQuestions") String drawnQuestions, @Param("version") String version);

    /**
     * 按唯一键回读未评分结果 id（upsert 后调用；返回 null 表示行已评分禁止重交，对齐 Go RETURNING id 空语义）。
     */
    @Select("SELECT id FROM node_evaluation_results"
        + " WHERE tenant_id = #{tenantId} AND node_id = #{nodeId} AND evaluatee_id = #{evaluateeId}"
        + " AND method_key = #{methodKey} AND graded_at IS NULL")
    String selectUngradedResultId(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                                  @Param("evaluateeId") String evaluateeId, @Param("methodKey") String methodKey);

    /** 评分（pending→evaluated，仅可评未评分结果）。 */
    @Update("UPDATE node_evaluation_results SET total_score = #{score}, comment = #{comment},"
        + " eval_point_scores = CAST(#{evalPointScores} AS JSON), status = 'evaluated',"
        + " graded_at = NOW(), graded_by = #{graderId}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = 'pending'")
    int grade(@Param("id") String id, @Param("tenantId") String tenantId, @Param("graderId") String graderId,
              @Param("score") BigDecimal score, @Param("comment") String comment,
              @Param("evalPointScores") String evalPointScores);

    /** 课程下全部节点的测评结果（教师评分列表用）。 */
    @Select("SELECT ner.id, ner.node_id, ner.method_key, ner.evaluatee_id, ner.evaluator_id, ner.evaluator_type, ner.status,"
        + " ner.total_score, ner.max_score, ner.eval_point_scores AS eval_point_scores,"
        + " ner.objective_answers AS objective_answers, ner.subjective_content AS subjective_content,"
        + " ner.drawn_questions AS drawn_questions, ner.comment, ner.graded_at, ner.graded_by, ner.version,"
        + " ner.created_at, ner.updated_at"
        + " FROM node_evaluation_results ner JOIN system_course_nodes n ON n.id = ner.node_id"
        + " WHERE ner.tenant_id = #{tenantId} AND n.course_id = #{courseId}"
        + " ORDER BY ner.created_at DESC LIMIT 1000")
    List<NodeEvaluationResult> selectByCourse(@Param("tenantId") String tenantId, @Param("courseId") String courseId);
}
