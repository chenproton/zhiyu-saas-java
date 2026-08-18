package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationQuestion;

/**
 * 题目 Mapper（questions 表）。
 *
 * @author zhiyu
 */
public interface EvaluationQuestionMapper extends BaseMapperPlus<EvaluationQuestion, EvaluationQuestion> {

    @Insert("INSERT INTO questions (id, tenant_id, code, bank_id, type, content, options, answer, analysis, score,"
        + " difficulty, knowledge_point_ids, creator_id, source, status)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{bankId}, #{type}, #{content}, #{options}, #{answer}, #{analysis},"
        + " #{score}, #{difficulty},"
        + " CAST(#{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " #{creatorId}, #{source}, 'draft')")
    int insertQuestion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                       @Param("bankId") String bankId, @Param("type") String type, @Param("content") String content,
                       @Param("options") String options, @Param("answer") String answer,
                       @Param("analysis") String analysis, @Param("score") java.math.BigDecimal score,
                       @Param("difficulty") String difficulty,
                       @Param("knowledgePointIds") java.util.List<String> knowledgePointIds,
                       @Param("creatorId") String creatorId, @Param("source") String source);

    @Update("<script>UPDATE questions SET type = #{type}, content = #{content}, options = #{options},"
        + " answer = #{answer}, analysis = #{analysis}, score = #{score}, difficulty = #{difficulty},"
        + " knowledge_point_ids = CAST(#{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " source = #{source}"
        + " <if test='bankId != null and bankId != \"\"'>, bank_id = #{bankId}</if>"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}</script>")
    int updateQuestion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("bankId") String bankId,
                       @Param("type") String type, @Param("content") String content, @Param("options") String options,
                       @Param("answer") String answer, @Param("analysis") String analysis,
                       @Param("score") java.math.BigDecimal score, @Param("difficulty") String difficulty,
                       @Param("knowledgePointIds") java.util.List<String> knowledgePointIds,
                       @Param("source") String source);

    @Select("SELECT EXISTS(SELECT 1 FROM questions WHERE tenant_id = #{tenantId}::uuid AND code = #{code})")
    boolean existsCode(@Param("tenantId") String tenantId, @Param("code") String code);

    /** 题目被试卷引用数（删除保护） */
    @Select("SELECT COUNT(*) FROM exam_questions WHERE question_id = #{questionId}::uuid")
    long countQuestionRefs(@Param("questionId") String questionId);

    /** 按配置顺序批量取题目（对齐 Go SyncExamQuestions 的 array_position 排序）。 */
    @Select("<script>SELECT id::text AS id, type, content, options, answer, analysis, score"
        + " FROM questions"
        + " WHERE id = ANY(CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]))"
        + " AND tenant_id = #{tenantId}::uuid"
        + " ORDER BY array_position(CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]), id)</script>")
    java.util.List<EvaluationQuestion> selectByIdsOrdered(@Param("ids") java.util.List<String> ids,
                                                         @Param("tenantId") String tenantId);
}
