package org.dromara.zhiyu.controller.ai;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.RenameConversationRequest;
import org.dromara.zhiyu.service.ai.IAiCenterService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 会话控制器（对齐 Go ai_center_handler.go 会话详情/重命名/删除）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/ai/conversations")
public class AiConversationController {

    private final IAiCenterService aiCenterService;

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable String id) {
        return aiCenterService.getConversation(id);
    }

    @PatchMapping("/{id}")
    public Map<String, String> rename(@PathVariable String id, @RequestBody RenameConversationRequest req) {
        return aiCenterService.renameConversation(id, req.getTitle());
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return aiCenterService.deleteConversation(id);
    }
}
