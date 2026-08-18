package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.AiAgent;

/**
 * AI 智能体 Mapper（ai_agents 表）。
 *
 * @author zhiyu
 */
public interface AiAgentMapper extends BaseMapperPlus<AiAgent, AiAgent> {

    /** 提交审核：private/rejected → pending（仅 owner，服务层校验角色） */
    @Update("UPDATE ai_agents SET status = 'pending', review_comment = '', reviewed_by = NULL,"
        + " reviewed_at = NULL, updated_at = now()"
        + " WHERE tenant_id = #{tenantId} AND id = #{id} AND status IN ('private','rejected')")
    int submitStatus(@Param("tenantId") String tenantId, @Param("id") String id);

    /** 下架：published → private（仅 owner） */
    @Update("UPDATE ai_agents SET status = 'private', review_comment = '', reviewed_by = NULL,"
        + " reviewed_at = NULL, updated_at = now()"
        + " WHERE tenant_id = #{tenantId} AND id = #{id} AND status = 'published'")
    int unpublishStatus(@Param("tenantId") String tenantId, @Param("id") String id);

    /** 审核流转（approve/reject/takedown，CAS） */
    @Update("UPDATE ai_agents SET status = #{toStatus}, review_comment = #{comment},"
        + " reviewed_by = NULLIF(#{reviewerId}, '')::uuid,"
        + " reviewed_at = CASE WHEN #{reviewerId} = '' THEN reviewed_at ELSE now() END, updated_at = now()"
        + " WHERE tenant_id = #{tenantId} AND id = #{id} AND status = #{fromStatus}")
    int reviewStatus(@Param("tenantId") String tenantId, @Param("id") String id,
                     @Param("fromStatus") String fromStatus, @Param("toStatus") String toStatus,
                     @Param("comment") String comment, @Param("reviewerId") String reviewerId);

    /** 对话轮数 +1（best-effort） */
    @Update("UPDATE ai_agents SET chat_count = chat_count + 1 WHERE tenant_id = #{tenantId} AND id = #{id}")
    int incrementChatCount(@Param("tenantId") String tenantId, @Param("id") String id);
}
