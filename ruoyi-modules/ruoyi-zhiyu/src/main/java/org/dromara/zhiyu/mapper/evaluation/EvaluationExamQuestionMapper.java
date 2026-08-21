package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationExamQuestion;

import java.util.List;
import java.util.Map;

/**
 * 试卷题目 Mapper（exam_questions 表）。
 *
 * @author zhiyu
 */
public interface EvaluationExamQuestionMapper extends BaseMapperPlus<EvaluationExamQuestion, EvaluationExamQuestion> {

    /** 批量统计各试卷题目数（key=exam_id，value=count） */
    @Select("<script>SELECT exam_id, COUNT(*) AS cnt FROM exam_questions WHERE exam_id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>"
        + " GROUP BY exam_id</script>")
    List<Map<String, Object>> countByExamIds(@Param("ids") List<String> ids);

    /** 批量更新题目分数并重算总分（事务内调用，限定租户） */
    @Update("<script>UPDATE exam_questions eq"
        + " JOIN JSON_TABLE(JSON_ARRAY(<foreach collection='ids' item='id' separator=','>#{id}</foreach>),"
        + "   '$[*]' COLUMNS (question_id CHAR(36) PATH '$', ord FOR ORDINALITY)) i ON 1 = 1"
        + " JOIN JSON_TABLE(JSON_ARRAY(<foreach collection='scores' item='sc' separator=','>#{sc}</foreach>),"
        + "   '$[*]' COLUMNS (score DECIMAL(10,2) PATH '$', ord2 FOR ORDINALITY)) s ON s.ord2 = i.ord"
        + " SET eq.score = s.score"
        + " WHERE eq.exam_id = #{examId} AND eq.tenant_id = #{tenantId} AND eq.question_id = i.question_id</script>")
    int bulkUpdateScores(@Param("ids") List<String> ids, @Param("scores") List<Double> scores,
                         @Param("examId") String examId, @Param("tenantId") String tenantId);

    @Update("UPDATE exams SET total_score = COALESCE((SELECT SUM(score) FROM exam_questions WHERE exam_id = #{examId}), 0),"
        + " updated_at = NOW() WHERE id = #{examId} AND tenant_id = #{tenantId}")
    int recalcExamTotal(@Param("examId") String examId, @Param("tenantId") String tenantId);

    /** 更新题目分数（限定租户，返回是否命中） */
    @Update("UPDATE exam_questions SET score = #{score} WHERE exam_id = #{examId} AND question_id = #{questionId}"
        + " AND tenant_id = #{tenantId}")
    int updateScore(@Param("examId") String examId, @Param("questionId") String questionId,
                    @Param("tenantId") String tenantId, @Param("score") java.math.BigDecimal score);

    /** 添加题目快照（重复添加时覆盖内容，sort_order 保持原值；对齐 Go AddQuestion ON CONFLICT） */
    @org.apache.ibatis.annotations.Insert("INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type,"
        + " content, options, answer, analysis, score, sort_order)"
        + " VALUES (#{id}, #{tenantId}, #{examId}, #{questionId}, #{type}, #{content}, #{options}, #{answer},"
        + " #{analysis}, #{score},"
        + " (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM exam_questions WHERE exam_id = #{examId}))"
        + " ON DUPLICATE KEY UPDATE"
        + " type = VALUES(type), content = VALUES(content), options = VALUES(options),"
        + " answer = VALUES(answer), analysis = VALUES(analysis), score = VALUES(score)")
    int insertExamQuestion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("examId") String examId,
                           @Param("questionId") String questionId, @Param("type") String type,
                           @Param("content") String content, @Param("options") String options,
                           @Param("answer") String answer, @Param("analysis") String analysis,
                           @Param("score") java.math.BigDecimal score);

    /** 移除已不选用的旧题（对齐 Go SyncExamQuestions 的 prune 分支）。 */
    @org.apache.ibatis.annotations.Delete("<script>DELETE FROM exam_questions"
        + " WHERE exam_id = #{examId} AND tenant_id = #{tenantId}"
        + " AND NOT (JSON_CONTAINS(CAST(#{questionIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(question_id), '$'))</script>")
    int deleteNotIn(@Param("examId") String examId, @Param("tenantId") String tenantId,
                    @Param("questionIds") List<String> questionIds);

    /** 按配置顺序 upsert 题目快照（对齐 Go SyncExamQuestions 的 ON CONFLICT 单语句写）。 */
    @org.apache.ibatis.annotations.Insert("INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type,"
        + " content, options, answer, analysis, score, sort_order)"
        + " VALUES (#{id}, #{tenantId}, #{examId}, #{questionId}, #{type}, #{content}, #{options}, #{answer},"
        + " #{analysis}, #{score}, #{sortOrder})"
        + " ON DUPLICATE KEY UPDATE type = VALUES(type), content = VALUES(content),"
        + " options = VALUES(options), answer = VALUES(answer), analysis = VALUES(analysis),"
        + " score = VALUES(score), sort_order = VALUES(sort_order)")
    int upsertExamQuestion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("examId") String examId,
                           @Param("questionId") String questionId, @Param("type") String type,
                           @Param("content") String content, @Param("options") String options,
                           @Param("answer") String answer, @Param("analysis") String analysis,
                           @Param("score") java.math.BigDecimal score, @Param("sortOrder") int sortOrder);
}
