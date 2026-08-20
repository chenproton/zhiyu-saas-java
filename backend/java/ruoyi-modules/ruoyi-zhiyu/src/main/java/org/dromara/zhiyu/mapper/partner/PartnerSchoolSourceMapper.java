package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.MajorDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.QuestionBankDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.KnowledgePointDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.QuestionDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.RandomDrawQuestionDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.ResourceDto;

import java.math.BigDecimal;
import java.util.List;

/**
 * 合作学校只读数据源 Mapper（编辑器选择器数据源，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface PartnerSchoolSourceMapper {

    // ===== 专业字典 =====

    @Select("<script>SELECT id, name, code, alias, enabled FROM majors"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\"> AND name LIKE CONCAT('%', #{search}, '%')</if>"
        + " ORDER BY name LIMIT #{limit} OFFSET #{offset}</script>")
    List<MajorDto> listMajors(@Param("tenantId") String tenantId, @Param("search") String search,
                              @Param("limit") int limit, @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM majors WHERE tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\"> AND name LIKE CONCAT('%', #{search}, '%')</if></script>")
    long countMajors(@Param("tenantId") String tenantId, @Param("search") String search);

    // ===== 题库 =====

    @Select("<script>SELECT id, name, code, description, status, question_count AS questionCount FROM question_banks"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\"> AND name LIKE CONCAT('%', #{search}, '%')</if>"
        + " ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<QuestionBankDto> listQuestionBanks(@Param("tenantId") String tenantId, @Param("search") String search,
                                            @Param("limit") int limit, @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM question_banks WHERE tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\"> AND name LIKE CONCAT('%', #{search}, '%')</if></script>")
    long countQuestionBanks(@Param("tenantId") String tenantId, @Param("search") String search);

    // ===== 知识点 =====

    @Select("<script>SELECT id, name, code, description, category FROM knowledge_points"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\"> AND name LIKE CONCAT('%', #{search}, '%')</if>"
        + " ORDER BY name LIMIT #{limit} OFFSET #{offset}</script>")
    List<KnowledgePointDto> listKnowledgePoints(@Param("tenantId") String tenantId, @Param("search") String search,
                                                @Param("limit") int limit, @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM knowledge_points WHERE tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\"> AND name LIKE CONCAT('%', #{search}, '%')</if></script>")
    long countKnowledgePoints(@Param("tenantId") String tenantId, @Param("search") String search);

    // ===== 题目 =====

    @Select("<script>SELECT id, bank_id AS bankId, type, content, code, difficulty, score, status FROM questions"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test=\"bankId != null and bankId != ''\"> AND bank_id = #{bankId}</if>"
        + " <if test=\"search != null and search != ''\"> AND content LIKE CONCAT('%', #{search}, '%')</if>"
        + " ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<QuestionDto> listQuestions(@Param("tenantId") String tenantId, @Param("bankId") String bankId,
                                    @Param("search") String search, @Param("limit") int limit,
                                    @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM questions WHERE tenant_id = #{tenantId}"
        + " <if test=\"bankId != null and bankId != ''\"> AND bank_id = #{bankId}</if>"
        + " <if test=\"search != null and search != ''\"> AND content LIKE CONCAT('%', #{search}, '%')</if></script>")
    long countQuestions(@Param("tenantId") String tenantId, @Param("bankId") String bankId,
                        @Param("search") String search);

    // ===== 现场问答题 =====

    @Select("<script>SELECT id, question_text AS questionText, answer, question_type AS questionType,"
        + " score, difficulty FROM on_site_question_library"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\"> AND question_text LIKE CONCAT('%', #{search}, '%')</if>"
        + " ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<RandomDrawQuestionDto> listRandomDrawQuestions(@Param("tenantId") String tenantId,
                                                        @Param("search") String search, @Param("limit") int limit,
                                                        @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM on_site_question_library WHERE tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\"> AND question_text LIKE CONCAT('%', #{search}, '%')</if></script>")
    long countRandomDrawQuestions(@Param("tenantId") String tenantId, @Param("search") String search);

    // ===== 资源库 =====

    @Select("<script>SELECT id, name, resource_type AS resourceType, url, description, thumbnail,"
        + " file_size AS fileSize FROM resource_library"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test=\"resourceType != null and resourceType != ''\"> AND resource_type = #{resourceType}</if>"
        + " <if test=\"search != null and search != ''\"> AND name LIKE CONCAT('%', #{search}, '%')</if>"
        + " ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<ResourceDto> listResources(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                                    @Param("search") String search, @Param("limit") int limit,
                                    @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM resource_library WHERE tenant_id = #{tenantId}"
        + " <if test=\"resourceType != null and resourceType != ''\"> AND resource_type = #{resourceType}</if>"
        + " <if test=\"search != null and search != ''\"> AND name LIKE CONCAT('%', #{search}, '%')</if></script>")
    long countResources(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                        @Param("search") String search);
}
