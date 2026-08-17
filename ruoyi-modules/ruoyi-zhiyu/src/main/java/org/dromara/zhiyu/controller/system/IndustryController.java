package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemIndustry;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.IndustryRequest;
import org.dromara.zhiyu.service.system.ISystemIndustryService;
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
 * 行业控制器（对齐 Go industry_handler.go 的 /industries 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/industries")
public class IndustryController {

    private final ISystemIndustryService industryService;

    @GetMapping
    public ListResponse<SystemIndustry> list(@RequestParam(value = "search", required = false) String search,
                                             @RequestParam(value = "parentId", required = false) String parentId,
                                             @RequestParam(value = "enabled", required = false) String enabled,
                                             @RequestParam(value = "limit", required = false) Long limit,
                                             @RequestParam(value = "offset", required = false) Long offset) {
        return industryService.list(search, parentId, enabled, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public SystemIndustry get(@PathVariable String id) {
        return industryService.get(id);
    }

    @PostMapping
    public SystemIndustry create(@RequestBody IndustryRequest req) {
        return industryService.create(req);
    }

    @PutMapping("/{id}")
    public SystemIndustry update(@PathVariable String id, @RequestBody IndustryRequest req) {
        return industryService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", industryService.delete(id));
    }
}
