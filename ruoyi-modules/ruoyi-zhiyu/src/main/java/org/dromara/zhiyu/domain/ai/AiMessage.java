package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 会话消息（ai_messages 表，Go→Java 迁移；无 updated_at 列）。
 *
 * <p>sources 为 jsonb（数组对象），按原始 JSON 文本读写并经 {@link JsonRawValue} 原样输出。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_messages")
public class AiMessage {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 会话 ID */
    private String conversationId;

    /** 角色（user/assistant） */
    private String role;

    /** 内容 */
    private String content;

    /** 溯源（jsonb 数组，原始 JSON 文本） */
    @JsonRawValue
    private String sources;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
