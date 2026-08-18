package org.dromara.zhiyu.controller.ai;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.ai.AiConversation;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ChatStreamRequest;
import org.dromara.zhiyu.service.ai.IAiCenterService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/**
 * YIKnow 通用会话控制器（对齐 Go ai_center_handler.go YIKnowChat/ListGeneralConversations）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/ai/yiknow")
public class AiYiknowController {

    private final IAiCenterService aiCenterService;

    @GetMapping("/conversations")
    public Map<String, Object> conversations() {
        List<AiConversation> items = aiCenterService.listGeneralConversations();
        return Map.of("items", items);
    }

    @PostMapping("/chat")
    public SseEmitter chat(@RequestBody ChatStreamRequest req) {
        String message = AiWeb.message(req.getMessage());
        return AiWeb.chat(aiCenterService.yiknowChat(req.getConversationId(), message));
    }
}
