package org.dromara.zhiyu.mapper.importexport;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 题目 Excel 导入 SQL（对齐 Go store/question_import_export.go）。
 *
 * <p>仅承载导入用 SQL；业务编排在 ImportExportServiceImpl.importQuestions。
 * 全部 SQL 显式携带 {@code tenant_id} 过滤（租户安全红线）；options/answer 以 JSON 原文
 * 承载（options 为 jsonb 列，写入显式 CAST）。</p>
 *
 * @author zhiyu
 */
public interface QuestionImportMapper {

    /** 校验题库存在性（限定租户），返回题库 ID；未命中返回 null。 */
    @Select("SELECT id FROM question_banks WHERE id = #{bankId} AND tenant_id = #{tenantId}")
    String selectQuestionBankIdScoped(@Param("bankId") String bankId, @Param("tenantId") String tenantId);

    /** 导入查重：按租户+题库+题干查询题目 ID/创建者。 */
    @Select("SELECT id AS id, COALESCE(creator_id, '') AS creator_id"
        + " FROM questions WHERE tenant_id = #{tenantId} AND bank_id = #{bankId} AND content = #{content} LIMIT 1")
    Map<String, Object> selectQuestionIdentity(@Param("tenantId") String tenantId, @Param("bankId") String bankId,
                                               @Param("content") String content);

    /** 按租户+题库+题干查询题目 ID（rename 模式判重）。 */
    @Select("SELECT id FROM questions WHERE tenant_id = #{tenantId} AND bank_id = #{bankId}"
        + " AND content = #{content} LIMIT 1")
    String selectQuestionIdByContent(@Param("tenantId") String tenantId, @Param("bankId") String bankId,
                                     @Param("content") String content);

    /** 覆盖导入：更新题目类型/选项/答案/解析/分值/难度/知识点（不更新题干；限定租户）。 */
    @Update("UPDATE questions SET type = #{type}, options = CAST(#{options} AS JSON), answer = #{answer},"
        + " analysis = #{analysis}, score = #{score}, difficulty = #{difficulty},"
        + " knowledge_point_ids = #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateQuestionImport(@Param("id") String id, @Param("tenantId") String tenantId, @Param("type") String type,
                             @Param("options") String options, @Param("answer") String answer,
                             @Param("analysis") String analysis, @Param("score") BigDecimal score,
                             @Param("difficulty") String difficulty,
                             @Param("knowledgePointIds") List<String> knowledgePointIds);

    /** 导入创建题目（draft 状态）。 */
    @Insert("INSERT INTO questions (id, tenant_id, code, bank_id, type, content, options, answer, analysis, score,"
        + " difficulty, knowledge_point_ids, creator_id, source, status)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{bankId}, #{type}, #{content},"
        + " CAST(#{options} AS JSON), #{answer}, #{analysis}, #{score}, #{difficulty},"
        + " #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{creatorId}, #{source}, 'draft')")
    int insertQuestionImport(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                             @Param("bankId") String bankId, @Param("type") String type,
                             @Param("content") String content, @Param("options") String options,
                             @Param("answer") String answer, @Param("analysis") String analysis,
                             @Param("score") BigDecimal score, @Param("difficulty") String difficulty,
                             @Param("knowledgePointIds") List<String> knowledgePointIds,
                             @Param("creatorId") String creatorId, @Param("source") String source);
}
