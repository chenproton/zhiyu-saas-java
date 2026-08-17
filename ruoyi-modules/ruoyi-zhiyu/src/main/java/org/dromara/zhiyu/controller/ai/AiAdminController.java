package org.dromara.zhiyu.controller.ai;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ai.AiIntegration;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.IntegrationInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.IntegrationToggleRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ReviewActionRequest;
import org.dromara.zhiyu.service.ai.IAiCenterService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * AI 中心管理端控制器（对齐 Go ai_center_admin_handler.go）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/ai/admin")
public class AiAdminController {

    private final IAiCenterService aiCenterService;

    @GetMapping("/reviews")
    public ListResponse<Object> reviews(@RequestParam(value = "type", required = false) String type,
                                        @RequestParam(value = "status", required = false) String status,
                                        @RequestParam(value = "page", required = false) Long page,
                                        @RequestParam(value = "pageSize", required = false) Long pageSize) {
        return aiCenterService.listReviews(type, status, page == null ? 1 : page, pageSize == null ? 20 : pageSize);
    }

    @PostMapping("/reviews/{type}/{id}/{action}")
    public Map<String, String> reviewAction(@PathVariable String type, @PathVariable String id,
                                            @PathVariable String action,
                                            @RequestBody(required = false) ReviewActionRequest req) {
        return aiCenterService.reviewAction(type, id, action, req == null ? null : req.getComment());
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return aiCenterService.adminOverview();
    }

    @GetMapping("/integrations")
    public Map<String, Object> integrations(@RequestParam(value = "kind", required = false) String kind) {
        List<AiIntegration> items = aiCenterService.listAdminIntegrations(kind);
        return Map.of("items", items);
    }

    @PostMapping("/integrations")
    public AiIntegration createIntegration(@RequestBody IntegrationInput in) {
        return aiCenterService.createIntegration(in);
    }

    @PutMapping("/integrations/{id}")
    public Map<String, String> updateIntegration(@PathVariable String id, @RequestBody IntegrationInput in) {
        return aiCenterService.updateIntegration(id, in);
    }

    @PostMapping("/integrations/{id}/toggle")
    public Map<String, String> toggleIntegration(@PathVariable String id, @RequestBody IntegrationToggleRequest req) {
        return aiCenterService.toggleIntegration(id, req.getStatus());
    }

    @DeleteMapping("/integrations/{id}")
    public Map<String, String> deleteIntegration(@PathVariable String id) {
        return aiCenterService.deleteIntegration(id);
    }
}
