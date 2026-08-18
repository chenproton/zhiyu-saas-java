package org.dromara.zhiyu.controller.ai;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIChatRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIChatResponse;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIConfigView;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIUsageStats;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.PositionAssistRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.PositionAssistResponse;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.SaveAIConfigRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioAssistRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioAssistResponse;
import org.dromara.zhiyu.service.ai.IAiService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 租户 AI 配置 / 用量 / 统一对话（对齐 Go ai_handler.go）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/ai")
public class AiConfigController {

    private final IAiService aiService;

    /** 查看租户 AI 配置（脱敏） */
    @GetMapping("/config")
    public AIConfigView getConfig() {
        aiService.requireManagePortal();
        return aiService.getConfig(AiWeb.tenant());
    }

    /** 保存租户 AI 配置 */
    @PutMapping("/config")
    public Map<String, String> saveConfig(@RequestBody SaveAIConfigRequest req) {
        aiService.requireManagePortal();
        aiService.saveConfig(AiWeb.tenant(), req);
        return Map.of("status", "ok");
    }

    /** 清除租户 AI 配置 */
    @DeleteMapping("/config")
    public Map<String, String> deleteConfig() {
        aiService.requireManagePortal();
        aiService.deleteConfig(AiWeb.tenant());
        return Map.of("status", "ok");
    }

    /** 租户 AI 用量统计 */
    @GetMapping("/usage")
    public AIUsageStats getUsage() {
        aiService.requireManagePortal();
        return aiService.getUsage(AiWeb.tenant());
    }

    /** 统一对话（非流式） */
    @PostMapping("/chat")
    public AIChatResponse chat(@RequestBody AIChatRequest req) {
        return aiService.chat(AiWeb.tenant(), AiWeb.user(), req);
    }

    /** 岗位 AI 辅助编写 */
    @PostMapping("/position-assist")
    public PositionAssistResponse positionAssist(@RequestBody PositionAssistRequest req) {
        return aiService.positionAssist(AiWeb.tenant(), AiWeb.user(), req.getField(), req.getPosition());
    }

    /** 场景/任务 AI 辅助编写 */
    @PostMapping("/scenario-assist")
    public ScenarioAssistResponse scenarioAssist(@RequestBody ScenarioAssistRequest req) {
        return aiService.scenarioAssist(AiWeb.tenant(), AiWeb.user(), req.getField(), req.getScenario());
    }
}
