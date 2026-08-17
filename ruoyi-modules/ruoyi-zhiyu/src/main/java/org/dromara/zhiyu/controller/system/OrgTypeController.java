package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemOrgType;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.OrgTypeRequest;
import org.dromara.zhiyu.service.system.ISystemOrgTypeService;
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
 * 组织类型控制器（对齐 Go org_type_handler.go 的 /org-types 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/org-types")
public class OrgTypeController {

    private final ISystemOrgTypeService orgTypeService;

    @GetMapping
    public ListResponse<SystemOrgType> list(@RequestParam(value = "search", required = false) String search,
                                            @RequestParam(value = "category", required = false) String category,
                                            @RequestParam(value = "limit", required = false) Long limit,
                                            @RequestParam(value = "offset", required = false) Long offset) {
        return orgTypeService.list(search, category, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public SystemOrgType get(@PathVariable String id) {
        return orgTypeService.get(id);
    }

    @PostMapping
    public SystemOrgType create(@RequestBody OrgTypeRequest req) {
        return orgTypeService.create(req);
    }

    @PutMapping("/{id}")
    public SystemOrgType update(@PathVariable String id, @RequestBody OrgTypeRequest req) {
        return orgTypeService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", orgTypeService.delete(id));
    }
}
