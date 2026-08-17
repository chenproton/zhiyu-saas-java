package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemOrganization;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateOrgRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.OrgTreeNode;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateOrgRequest;
import org.dromara.zhiyu.service.system.ISystemOrganizationService;
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
 * 组织控制器（对齐 Go org_handler.go 的 /organizations 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/organizations")
public class OrganizationController {

    private final ISystemOrganizationService orgService;

    @GetMapping
    public ListResponse<SystemOrganization> list(@RequestParam(value = "typeId", required = false) String typeId,
                                                 @RequestParam(value = "parentId", required = false) String parentId,
                                                 @RequestParam(value = "rootOnly", required = false) String rootOnly,
                                                 @RequestParam(value = "search", required = false) String search,
                                                 @RequestParam(value = "limit", required = false) Long limit,
                                                 @RequestParam(value = "offset", required = false) Long offset) {
        return orgService.list(typeId, parentId, rootOnly, search, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/tree")
    public Map<String, Object> tree() {
        return Map.of("items", orgService.tree());
    }

    @GetMapping("/{id}")
    public SystemOrganization get(@PathVariable String id) {
        return orgService.get(id);
    }

    @PostMapping
    public SystemOrganization create(@RequestBody CreateOrgRequest req) {
        return orgService.create(req);
    }

    @PutMapping("/{id}")
    public SystemOrganization update(@PathVariable String id, @RequestBody UpdateOrgRequest req) {
        return orgService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", orgService.delete(id));
    }
}
