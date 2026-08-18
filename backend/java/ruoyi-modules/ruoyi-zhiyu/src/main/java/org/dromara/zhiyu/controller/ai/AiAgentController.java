package org.dromara.zhiyu.controller.ai;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.ai.AiAgent;
import org.dromara.zhiyu.domain.ai.AiConversation;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AgentInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ChatStreamRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.PreviewAgentRequest;
import org.dromara.zhiyu.service.ai.IAiCenterService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/**
 * 智能体控制器（对齐 Go ai_center_handler.go 智能体/会话/预览）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/ai/agents")
public class AiAgentController {

    private final IAiCenterService aiCenterService;

    @GetMapping
    public Map<String, Object> list() {
        List<AiAgent> items = aiCenterService.listAgents();
        return Map.of("items", items);
    }

    @PostMapping
    public AiAgent create(@RequestBody AgentInput in) {
        return aiCenterService.createAgent(in);
    }

    @GetMapping("/{id}")
    public AiAgent get(@PathVariable String id) {
        return aiCenterService.getAgent(id);
    }

    @PutMapping("/{id}")
    public Map<String, String> update(@PathVariable String id, @RequestBody AgentInput in) {
        return aiCenterService.updateAgent(id, in);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return aiCenterService.deleteAgent(id);
    }

    @PostMapping("/{id}/submit")
    public Map<String, Object> submit(@PathVariable String id) {
        return aiCenterService.submitAgent(id);
    }

    @PostMapping("/{id}/unpublish")
    public Map<String, String> unpublish(@PathVariable String id) {
        return aiCenterService.unpublishAgent(id);
    }

    @PostMapping("/{id}/chat")
    public SseEmitter chat(@PathVariable String id, @RequestBody ChatStreamRequest req) {
        String message = AiWeb.message(req.getMessage());
        return AiWeb.chat(aiCenterService.agentChat(id, req.getConversationId(), message));
    }

    @GetMapping("/{id}/conversations")
    public Map<String, Object> conversations(@PathVariable String id) {
        List<AiConversation> items = aiCenterService.listConversations(id);
        return Map.of("items", items);
    }

    @PostMapping("/{id}/preview")
    public Map<String, String> preview(@PathVariable String id, @RequestBody PreviewAgentRequest req) {
        String message = AiWeb.message(req.getMessage());
        return aiCenterService.previewAgent(id, req.getSystemPrompt(), message);
    }
}
