package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityDomainDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityDomainRequest;
import org.dromara.zhiyu.service.job.IJobAbilityDomainService;
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
 * 能力域控制器（对齐 Go routes_job.go 的 /job/ability-domains 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/ability-domains")
public class JobAbilityDomainController {

    private final IJobAbilityDomainService abilityDomainService;

    /** 能力域列表（careerPositionId 过滤） */
    @GetMapping
    public ListResponse<AbilityDomainDto> list(@RequestParam(value = "careerPositionId", required = false) String careerPositionId,
                                               @RequestParam(value = "limit", required = false) Long limit,
                                               @RequestParam(value = "offset", required = false) Long offset) {
        return abilityDomainService.list(careerPositionId,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 能力域详情 */
    @GetMapping("/{id}")
    public AbilityDomainDto get(@PathVariable String id) {
        return abilityDomainService.get(id);
    }

    /** 创建能力域 */
    @PostMapping
    public AbilityDomainDto create(@RequestBody AbilityDomainRequest req) {
        return abilityDomainService.create(req);
    }

    /** 更新能力域 */
    @PutMapping("/{id}")
    public AbilityDomainDto update(@PathVariable String id, @RequestBody AbilityDomainRequest req) {
        return abilityDomainService.update(id, req);
    }

    /** 删除能力域 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", abilityDomainService.delete(id));
    }
}
