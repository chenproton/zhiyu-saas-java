package org.dromara.zhiyu.controller.ai;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ai.AiAgent;
import org.dromara.zhiyu.domain.ai.AiIntegration;
import org.dromara.zhiyu.domain.ai.AiKnowledgeBase;
import org.dromara.zhiyu.service.ai.IAiCenterService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 广场与第三方挂接展示控制器（对齐 Go ai_center_handler.go 广场/挂接）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/ai")
public class AiSquareController {

    private final IAiCenterService aiCenterService;

    @GetMapping("/square/kbs")
    public ListResponse<AiKnowledgeBase> squareKbs(@RequestParam(value = "q", required = false) String q,
                                                   @RequestParam(value = "tag", required = false) String tag,
                                                   @RequestParam(value = "sort", required = false) String sort,
                                                   @RequestParam(value = "page", required = false) Long page,
                                                   @RequestParam(value = "pageSize", required = false) Long pageSize,
                                                   @RequestParam(value = "majorId", required = false) String majorId,
                                                   @RequestParam(value = "departmentId", required = false) String departmentId,
                                                   @RequestParam(value = "kbType", required = false) String kbType,
                                                   @RequestParam(value = "updated", required = false) String updated) {
        return aiCenterService.squareKbs(q, tag, sort, page == null ? 1 : page, pageSize == null ? 20 : pageSize,
            majorId, departmentId, kbType, updated);
    }

    @GetMapping("/square/agents")
    public ListResponse<AiAgent> squareAgents(@RequestParam(value = "q", required = false) String q,
                                              @RequestParam(value = "sort", required = false) String sort,
                                              @RequestParam(value = "page", required = false) Long page,
                                              @RequestParam(value = "pageSize", required = false) Long pageSize,
                                              @RequestParam(value = "majorId", required = false) String majorId,
                                              @RequestParam(value = "departmentId", required = false) String departmentId,
                                              @RequestParam(value = "updated", required = false) String updated) {
        return aiCenterService.squareAgents(q, sort, page == null ? 1 : page, pageSize == null ? 20 : pageSize,
            majorId, departmentId, updated);
    }

    @GetMapping("/integrations")
    public Map<String, Object> integrations(@RequestParam(value = "kind", required = false) String kind) {
        List<AiIntegration> items = aiCenterService.listIntegrations(kind);
        return Map.of("items", items);
    }
}
