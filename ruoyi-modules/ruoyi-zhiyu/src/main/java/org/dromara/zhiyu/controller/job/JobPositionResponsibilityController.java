package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionResponsibilityDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionResponsibilityRequest;
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
 * 岗位职责控制器（对齐 Go routes_job.go 的 /job/position-responsibilities 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/position-responsibilities")
public class JobPositionResponsibilityController {

    private final IJobPositionConfigService positionConfigService;

    /** 岗位职责列表（careerPositionId 过滤） */
    @GetMapping
    public ListResponse<PositionResponsibilityDto> list(@RequestParam(value = "careerPositionId", required = false) String careerPositionId,
                                                        @RequestParam(value = "limit", required = false) Long limit,
                                                        @RequestParam(value = "offset", required = false) Long offset) {
        return positionConfigService.listResponsibilities(careerPositionId,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 岗位职责详情 */
    @GetMapping("/{id}")
    public PositionResponsibilityDto get(@PathVariable String id) {
        return positionConfigService.getResponsibility(id);
    }

    /** 创建岗位职责 */
    @PostMapping
    public PositionResponsibilityDto create(@RequestBody PositionResponsibilityRequest req) {
        return positionConfigService.createResponsibility(req);
    }

    /** 更新岗位职责 */
    @PutMapping("/{id}")
    public PositionResponsibilityDto update(@PathVariable String id, @RequestBody PositionResponsibilityRequest req) {
        return positionConfigService.updateResponsibility(id, req);
    }

    /** 删除岗位职责 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", positionConfigService.deleteResponsibility(id));
    }
}
