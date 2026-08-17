package org.dromara.zhiyu.controller.ai;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIConfigView;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.SaveAIConfigRequest;
import org.dromara.zhiyu.service.ai.IAiService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 超管代租户维护 AI 配置（对齐 Go ai_handler.go Admin* 系列）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/admin/tenants")
public class AiTenantConfigController {

    private final IAiService aiService;

    @GetMapping("/{tenantId}/ai/config")
    public AIConfigView getConfig(@PathVariable String tenantId) {
        return aiService.getConfig(tenantId);
    }

    @PutMapping("/{tenantId}/ai/config")
    public Map<String, String> saveConfig(@PathVariable String tenantId, @RequestBody SaveAIConfigRequest req) {
        aiService.saveConfig(tenantId, req);
        return Map.of("status", "ok");
    }

    @DeleteMapping("/{tenantId}/ai/config")
    public Map<String, String> deleteConfig(@PathVariable String tenantId) {
        aiService.deleteConfig(tenantId);
        return Map.of("status", "ok");
    }
}
