package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationQuestionBank;

import java.util.List;
import java.util.Map;

/**
 * 题库 Mapper（question_banks 表）。
 *
 * <p>uuid[] 数组列写入需显式 CAST，故创建/更新走自定义 SQL；读取走内置方法。</p>
 *
 * @author zhiyu
 */
public interface EvaluationQuestionBankMapper extends BaseMapperPlus<EvaluationQuestionBank, EvaluationQuestionBank> {

    @Insert("INSERT INTO question_banks (id, tenant_id, code, name, description, cover_image, status, question_count,"
        + " creator_id, collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, is_draft_pool)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, #{description}, #{coverImage}, 'draft', 0, #{creatorId},"
        + " #{collaboratorIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{collaboratorDeptIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{batchId}, 'V1.0', 'mine', FALSE)")
    int insertBank(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                   @Param("name") String name, @Param("description") String description,
                   @Param("coverImage") String coverImage, @Param("creatorId") String creatorId,
                   @Param("collaboratorIds") List<String> collaboratorIds,
                   @Param("collaboratorDeptIds") List<String> collaboratorDeptIds,
                   @Param("batchId") String batchId);

    @Update("UPDATE question_banks SET name = #{name}, description = #{description}, cover_image = #{coverImage},"
        + " collaborator_ids = #{collaboratorIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " collaborator_dept_ids = #{collaboratorDeptIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " batch_id = #{batchId}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateBank(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                   @Param("description") String description, @Param("coverImage") String coverImage,
                   @Param("collaboratorIds") List<String> collaboratorIds,
                   @Param("collaboratorDeptIds") List<String> collaboratorDeptIds,
                   @Param("batchId") String batchId);

    @Select("SELECT EXISTS(SELECT 1 FROM question_banks WHERE tenant_id = #{tenantId} AND code = #{code})")
    boolean existsCode(@Param("tenantId") String tenantId, @Param("code") String code);

    /** 批量统计各题库题目数（key=bank_id，value=count） */
    @Select("<script>SELECT bank_id, COUNT(*) AS cnt FROM questions WHERE bank_id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>"
        + " GROUP BY bank_id</script>")
    List<Map<String, Object>> countQuestionsByBankIds(@Param("ids") List<String> ids);

    /** 批量查询题库知识点绑定（key=question_bank_id，value=knowledge_point_id 列表） */
    @Select("<script>SELECT question_bank_id AS bank_id, knowledge_point_id AS kp_id"
        + " FROM question_bank_knowledge_points WHERE question_bank_id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></script>")
    List<Map<String, Object>> selectKpByBankIds(@Param("ids") List<String> ids);

    /** 题库知识点全量替换（事务内先删后插） */
    @Insert("<script>INSERT INTO question_bank_knowledge_points (id, question_bank_id, knowledge_point_id) VALUES"
        + " <foreach collection='kps' item='kp' separator=','>"
        + " ((UUID()), #{bankId}, #{kp})</foreach>"
        + " ON DUPLICATE KEY UPDATE id = id</script>")
    int insertKps(@Param("bankId") String bankId, @Param("kps") List<String> kps);

    @org.apache.ibatis.annotations.Delete("DELETE FROM question_bank_knowledge_points WHERE question_bank_id = #{bankId}")
    int deleteKps(@Param("bankId") String bankId);

    /** 题库下题目被试卷引用数（删除保护） */
    @Select("SELECT COUNT(DISTINCT q.id) FROM questions q JOIN exam_questions eq ON eq.question_id = q.id"
        + " WHERE q.bank_id = #{bankId}")
    long countBankQuestionRefs(@Param("bankId") String bankId);

    /** CAS 状态流转（限定租户 + 状态，防并发双发） */
    @Update("UPDATE question_banks SET status = #{toStatus}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId} AND status = #{fromStatus}")
    int casTransition(@Param("id") String id, @Param("tenantId") String tenantId,
                      @Param("fromStatus") String fromStatus, @Param("toStatus") String toStatus);

    /** 发布时版本 +0.1 */
    @Update("UPDATE question_banks SET version = #{version}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int bumpVersion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("version") String version);

    /** 邀请协作者（数组去重追加） */
    @Update("UPDATE question_banks SET collaborator_ids = JSON_ARRAY_APPEND(collaborator_ids, '$', #{userId}), updated_at = NOW()"
        + " WHERE id = #{id} AND NOT (JSON_CONTAINS(collaborator_ids, JSON_QUOTE(#{userId}), '$'))")
    int inviteCollaborator(@Param("id") String id, @Param("userId") String userId);

    /** 从审批中撤回时删除待审批记录 */
    @org.apache.ibatis.annotations.Delete("DELETE FROM approval_records WHERE target_type = #{targetType}"
        + " AND target_id = #{targetId} AND status = 'pending'")
    int deletePendingApproval(@Param("targetType") String targetType, @Param("targetId") String targetId);

    /** 确保用户草稿池存在（对齐 Go EnsureDraftPool） */
    @Select("SELECT COUNT(*) FROM question_banks WHERE tenant_id = #{tenantId} AND creator_id = #{creatorId} AND is_draft_pool = true")
    int countDraftPool(@Param("tenantId") String tenantId, @Param("creatorId") String creatorId);

    @Insert("INSERT INTO question_banks (id, tenant_id, code, name, description, status, question_count, creator_id,"
        + " collaborator_ids, collaborator_dept_ids, version, owner_type, is_draft_pool)"
        + " VALUES (#{id}, #{tenantId}, #{code}, '我的草稿库', '', 'draft', 0, #{creatorId}, '{}', '{}', 'V1.0', 'mine', true)"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertDraftPool(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                        @Param("creatorId") String creatorId);
}
