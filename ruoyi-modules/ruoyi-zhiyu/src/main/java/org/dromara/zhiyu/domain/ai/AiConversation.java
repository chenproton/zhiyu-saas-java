package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * AI 会话（ai_conversations 表，Go→Java 迁移）。
 *
 * <p>agent_id 为空表示通用 YIKnow 会话（列可空）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_conversations")
public class AiConversation extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 智能体 ID（空=通用 YIKnow 会话） */
    private String agentId;

    /** 用户 ID */
    private String userId;

    /** 标题 */
    private String title;
}
