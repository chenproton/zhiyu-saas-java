package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.AiConversation;

/**
 * AI 会话 Mapper（ai_conversations 表）。
 *
 * @author zhiyu
 */
public interface AiConversationMapper extends BaseMapperPlus<AiConversation, AiConversation> {

    /** 刷新会话活跃时间 + 标题（仅当 title 为空时写入首条消息标题） */
    @Update("UPDATE ai_conversations SET updated_at = now(),"
        + " title = CASE WHEN title = '' THEN #{titleIfEmpty} ELSE title END"
        + " WHERE tenant_id = #{tenantId} AND id = #{id}")
    int touch(@Param("tenantId") String tenantId, @Param("id") String id,
              @Param("titleIfEmpty") String titleIfEmpty);

    /** 重命名会话（仅本人；返回影响行数） */
    @Update("UPDATE ai_conversations SET title = #{title}, updated_at = now()"
        + " WHERE tenant_id = #{tenantId} AND id = #{id} AND user_id = #{userId}")
    int rename(@Param("tenantId") String tenantId, @Param("id") String id,
               @Param("userId") String userId, @Param("title") String title);
}
