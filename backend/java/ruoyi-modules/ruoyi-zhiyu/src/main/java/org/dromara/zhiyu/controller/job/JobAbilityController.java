package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityPointDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.UncitedItemDto;
import org.dromara.zhiyu.service.job.IJobAbilityService;
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
 * 能力点控制器（对齐 Go routes_job.go 的 /job/abilities 路由组 + 只读统计接口）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/abilities")
public class JobAbilityController {

    private final IJobAbilityService abilityService;

    /** 能力点列表（search/isPublic/creatorId 过滤） */
    @GetMapping
    public ListResponse<AbilityPointDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                              @RequestParam(value = "offset", required = false) Long offset,
                                              @RequestParam(value = "search", required = false) String search,
                                              @RequestParam(value = "isPublic", required = false) String isPublic,
                                              @RequestParam(value = "creatorId", required = false) String creatorId) {
        return abilityService.list(search, isPublic, creatorId,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 能力点详情 */
    @GetMapping("/{id}")
    public AbilityPointDto get(@PathVariable String id) {
        return abilityService.get(id);
    }

    /** 创建能力点 */
    @PostMapping
    public AbilityPointDto create(@RequestBody AbilityRequest req) {
        return abilityService.create(req);
    }

    /** 更新能力点 */
    @PutMapping("/{id}")
    public AbilityPointDto update(@PathVariable String id, @RequestBody AbilityRequest req) {
        return abilityService.update(id, req);
    }

    /** 删除能力点 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", abilityService.delete(id));
    }

    /** 引用次数分布统计（顶部指标卡片用） */
    @GetMapping("/citation-stats")
    public CitationStatsDto citationStats() {
        return abilityService.citationStats();
    }

    /** 零引用能力点列表（startDate/endDate 时段筛选 + 分页） */
    @GetMapping("/uncited")
    public ListResponse<UncitedItemDto> uncited(@RequestParam(value = "startDate", required = false) String startDate,
                                                @RequestParam(value = "endDate", required = false) String endDate,
                                                @RequestParam(value = "limit", required = false) Long limit,
                                                @RequestParam(value = "offset", required = false) Long offset) {
        return abilityService.uncited(startDate, endDate,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }
}
