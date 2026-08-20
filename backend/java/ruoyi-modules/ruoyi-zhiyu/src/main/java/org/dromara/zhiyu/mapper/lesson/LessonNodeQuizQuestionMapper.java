package org.dromara.zhiyu.mapper.lesson;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.lesson.LessonNodeQuizQuestion;

import java.math.BigDecimal;
import java.util.List;

/**
 * 节点测验题目 Mapper（node_quiz_questions 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface LessonNodeQuizQuestionMapper extends BaseMapperPlus<LessonNodeQuizQuestion, LessonNodeQuizQuestion> {

    /** 查询题目总数（限定测验+租户）。 */
    @Select("SELECT COUNT(*) FROM node_quiz_questions WHERE quiz_id = #{quizId} AND tenant_id = #{tenantId}")
    long countQuestions(@Param("quizId") String quizId, @Param("tenantId") String tenantId);

    /** 题目列表（按 sort_order 升序，limit/offset 分页）。 */
    @Select("SELECT id, quiz_id, type, question, options AS options, answer, score, sort_order, tenant_id"
        + " FROM node_quiz_questions WHERE quiz_id = #{quizId} AND tenant_id = #{tenantId}"
        + " ORDER BY sort_order ASC LIMIT #{limit} OFFSET #{offset}")
    List<LessonNodeQuizQuestion> selectQuestions(@Param("quizId") String quizId, @Param("tenantId") String tenantId,
                                                 @Param("limit") int limit, @Param("offset") int offset);

    /** 查询单个题目（限定租户）。 */
    @Select("SELECT id, quiz_id, type, question, options AS options, answer, score, sort_order, tenant_id"
        + " FROM node_quiz_questions WHERE id = #{id} AND tenant_id = #{tenantId}")
    LessonNodeQuizQuestion selectQuestion(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 添加题目，返回 id。 */
    @Insert("INSERT INTO node_quiz_questions (id, tenant_id, quiz_id, type, question, options, answer, score, sort_order)"
        + " VALUES ((UUID()), #{tenantId}, #{quizId}, #{type}, #{question},"
        + " CAST(#{options} AS JSON), #{answer}, #{score}, #{sortOrder}) RETURNING id")
    String insertQuestion(@Param("tenantId") String tenantId, @Param("quizId") String quizId, @Param("type") String type,
                          @Param("question") String question, @Param("options") String options,
                          @Param("answer") String answer, @Param("score") BigDecimal score,
                          @Param("sortOrder") Integer sortOrder);

    /** 更新题目（限定租户）。 */
    @Update("UPDATE node_quiz_questions SET type = #{type}, question = #{question},"
        + " options = CAST(#{options} AS JSON), answer = #{answer}, score = #{score}, sort_order = #{sortOrder}"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateQuestion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("type") String type,
                       @Param("question") String question, @Param("options") String options,
                       @Param("answer") String answer, @Param("score") BigDecimal score,
                       @Param("sortOrder") Integer sortOrder);

    /** 删除题目（限定租户）。 */
    @Delete("DELETE FROM node_quiz_questions WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteQuestion(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 删除测验下的全部题目（删除测验时事务内级联清理，限定租户）。 */
    @Delete("DELETE FROM node_quiz_questions WHERE quiz_id = #{quizId} AND tenant_id = #{tenantId}")
    int deleteByQuiz(@Param("quizId") String quizId, @Param("tenantId") String tenantId);
}
