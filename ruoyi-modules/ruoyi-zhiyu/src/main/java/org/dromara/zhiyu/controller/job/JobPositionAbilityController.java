package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionAbilityBindingDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionAbilityRequest;
import org.dromara.zhiyu.service.job.IJobPositionConfigService;
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

import java.util.Map;

/**
 * 岗位-能力绑定控制器（对齐 Go routes_job.go 的 /job/position-abilities 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/position-abilities")
public class JobPositionAbilityController {

    private final IJobPositionConfigService positionConfigService;

    /** 能力绑定列表（careerPositionId/responsibilityId 过滤） */
    @GetMapping
    public ListResponse<PositionAbilityBindingDto> list(@RequestParam(value = "careerPositionId", required = false) String careerPositionId,
                                                        @RequestParam(value = "responsibilityId", required = false) String responsibilityId,
                                                        @RequestParam(value = "limit", required = false) Long limit,
                                                        @RequestParam(value = "offset", required = false) Long offset) {
        return positionConfigService.listBindings(careerPositionId, responsibilityId,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 创建能力绑定 */
    @PostMapping
    public PositionAbilityBindingDto create(@RequestBody PositionAbilityRequest req) {
        return positionConfigService.createBinding(req);
    }

    /** 更新能力绑定 */
    @PutMapping("/{id}")
    public PositionAbilityBindingDto update(@PathVariable String id, @RequestBody PositionAbilityRequest req) {
        return positionConfigService.updateBinding(id, req);
    }

    /** 删除能力绑定 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", positionConfigService.deleteBinding(id));
    }
}
