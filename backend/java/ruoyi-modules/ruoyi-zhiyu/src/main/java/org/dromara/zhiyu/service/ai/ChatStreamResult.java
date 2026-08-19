package org.dromara.zhiyu.service.ai;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * SSE 流式对话结果（由 service 完成预检与会话/溯源落库后返回，controller 负责发射 SSE 事件）。
 *
 * <p>流式路径：{@link #stream()} 非空时，controller 调用 {@link StreamSource#execute(Consumer)}
 * 执行上游流式调用（逐 delta 经 onDelta 实时下发），并据返回的 {@link StreamDone} 发射
 * done 事件；{@code stream} 为空时回退到按 {@link #reply()} 切片（仅兼容遗留路径）。</p>
 *
 * @param conversationId    会话 ID（KB 问答无会话，为 null 时前端不发 meta）
 * @param messageId         用户消息 ID
 * @param reply             完整回复文本（流式路径下由 StreamSource 聚合，构造时可传 null）
 * @param assistantMessageId 助手消息 ID（agent 对话 done 事件携带；流式路径由 StreamDone 携带）
 * @param doneWithAnswer    true 表示 done 事件携带 answer 字段（KB 问答 / YIKnow）
 * @param sources           召回溯源（可能为空；非空时 controller 发射 sources 事件）
 * @param stream            流式来源（非空时优先走真流式）
 * @author zhiyu
 */
public record ChatStreamResult(String conversationId, String messageId, String reply,
                               String assistantMessageId, boolean doneWithAnswer,
                               List<Map<String, Object>> sources, StreamSource stream) {

    /** 流式来源：execute 时执行上游流式调用，delta 经 onDelta 实时回调，返回聚合结果。 */
    @FunctionalInterface
    public interface StreamSource {
        StreamDone execute(Consumer<String> onDelta);
    }

    /** 流式聚合结果：完整回复 + 助手消息 ID（agent 对话 done 事件携带）。 */
    public record StreamDone(String reply, String assistantMessageId) {
    }
}
