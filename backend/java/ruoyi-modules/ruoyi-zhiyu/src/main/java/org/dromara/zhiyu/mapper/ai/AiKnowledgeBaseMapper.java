package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.AiKnowledgeBase;

import java.util.List;

/**
 * AI 知识库 Mapper（ai_knowledge_bases 表）。
 *
 * <p>读取走 MyBatis-Plus 内置方法（jsonb 列经 JsonStringListTypeHandler 映射）；
 * 状态流转走自定义 CAS SQL（对齐 Go store.SetKBStatus 语义）。</p>
 *
 * @author zhiyu
 */
public interface AiKnowledgeBaseMapper extends BaseMapperPlus<AiKnowledgeBase, AiKnowledgeBase> {

    /** 提交上架：private/rejected → pending（仅 owner，服务层校验角色） */
    @Update("UPDATE ai_knowledge_bases SET status = 'pending', review_comment = '', reviewed_by = NULL,"
        + " reviewed_at = NULL, updated_at = now()"
        + " WHERE tenant_id = #{tenantId} AND id = #{id} AND status IN ('private','rejected')")
    int submitStatus(@Param("tenantId") String tenantId, @Param("id") String id);

    /** 下架：published → private（仅 owner） */
    @Update("UPDATE ai_knowledge_bases SET status = 'private', review_comment = '', reviewed_by = NULL,"
        + " reviewed_at = NULL, updated_at = now()"
        + " WHERE tenant_id = #{tenantId} AND id = #{id} AND status = 'published'")
    int unpublishStatus(@Param("tenantId") String tenantId, @Param("id") String id);

    /** 审核流转（approve/reject/takedown，CAS：要求当前状态为 fromStatus） */
    @Update("UPDATE ai_knowledge_bases SET status = #{toStatus}, review_comment = #{comment},"
        + " reviewed_by = NULLIF(#{reviewerId}, '')::uuid,"
        + " reviewed_at = CASE WHEN #{reviewerId} = '' THEN reviewed_at ELSE now() END, updated_at = now()"
        + " WHERE tenant_id = #{tenantId} AND id = #{id} AND status = #{fromStatus}")
    int reviewStatus(@Param("tenantId") String tenantId, @Param("id") String id,
                     @Param("fromStatus") String fromStatus, @Param("toStatus") String toStatus,
                     @Param("comment") String comment, @Param("reviewerId") String reviewerId);

    /** 问答计数 +1（best-effort） */
    @Update("<script>UPDATE ai_knowledge_bases SET ask_count = ask_count + 1 WHERE tenant_id = #{tenantId}"
        + " AND id IN <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></script>")
    int incrementAskCount(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    /** 重算 ready 文档数冗余列（对齐 Go store.RefreshKBDocCount，best-effort） */
    @Update("UPDATE ai_knowledge_bases kb SET doc_count = ("
        + " SELECT COUNT(*) FROM ai_kb_documents d WHERE d.tenant_id = kb.tenant_id AND d.kb_id = kb.id AND d.status = 'ready'"
        + ") WHERE kb.tenant_id = #{tenantId} AND kb.id = #{kbId}")
    int refreshDocCount(@Param("tenantId") String tenantId, @Param("kbId") String kbId);

}
