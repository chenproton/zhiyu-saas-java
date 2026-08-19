package org.dromara.zhiyu.controller.ai;

import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.service.ai.ChatStreamResult;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * AI 控制器 Web 层辅助（租户/用户上下文 + SSE 流式发射）。
 *
 * <p>SSE 事件协议对齐 Go（meta/sources/delta/done）；上游 stream=true 的增量经
 * {@link ChatStreamResult.StreamSource} 逐 delta 实时下发（真流式）。</p>
 *
 * @author zhiyu
 */
final class AiWeb {

    private AiWeb() {
    }

    /** 当前租户 ID（缺失 → 403） */
    static String tenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    /** 当前用户 ID（缺失 → 403） */
    static String user() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    /** 校验消息并去空白（缺失/超长 → 400） */
    static String message(String raw) {
        String m = raw == null ? "" : raw.trim();
        if (m.isEmpty() || m.codePointCount(0, m.length()) > 2000) {
            throw new ApiException(400, "bad_request", "消息必填且不超过 2000 字");
        }
        return m;
    }

    /** 将流式对话结果转换为 SSE 响应（meta → sources → delta* → done） */
    static SseEmitter chat(ChatStreamResult r) {
        SseEmitter emitter = new SseEmitter(60_000L);
        CompletableFuture.runAsync(() -> {
            try {
                if (r.conversationId() != null && r.messageId() != null) {
                    send(emitter, "meta", Map.of("conversationId", r.conversationId(), "messageId", r.messageId()));
                }
                if (r.sources() != null && !r.sources().isEmpty()) {
                    send(emitter, "sources", r.sources());
                }
                // 真流式：上游 stream=true 逐 delta 实时下发
                ChatStreamResult.StreamDone done = r.stream().execute(delta -> {
                    try {
                        send(emitter, "delta", Map.of("text", delta));
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                });
                if (r.doneWithAnswer()) {
                    send(emitter, "done", Map.of("answer", done.reply()));
                } else {
                    send(emitter, "done", Map.of("messageId", done.assistantMessageId()));
                }
                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        });
        return emitter;
    }

    private static void send(SseEmitter emitter, String event, Object data) throws IOException {
        emitter.send(SseEmitter.event().name(event).data(data));
    }
}
