package org.dromara.zhiyu.service.ai;

/**
 * SSE 流式对话结果（由 service 完成预检与落库后返回，controller 负责发射 SSE 事件）。
 *
 * @param conversationId    会话 ID（KB 问答无会话，为 null 时前端不发 meta）
 * @param messageId         用户消息 ID
 * @param reply             完整回复文本
 * @param assistantMessageId 助手消息 ID（agent 对话 done 事件携带）
 * @param doneWithAnswer    true 表示 done 事件携带 answer 字段（KB 问答 / YIKnow）
 * @author zhiyu
 */
public record ChatStreamResult(String conversationId, String messageId, String reply,
                               String assistantMessageId, boolean doneWithAnswer) {
}
