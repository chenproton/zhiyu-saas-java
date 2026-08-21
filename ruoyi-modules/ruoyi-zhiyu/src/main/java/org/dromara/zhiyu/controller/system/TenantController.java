package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ZhiyuTenant;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateTenantRequest;
import org.dromara.zhiyu.service.system.ISystemTenantService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 门户侧租户控制器（对齐 Go registerPortalRoutes 的 /tenants 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {

    private final ISystemTenantService tenantService;

    @GetMapping
    public ListResponse<ZhiyuTenant> list(@RequestParam(value = "search", required = false) String search,
                                          @RequestParam(value = "status", required = false) String status,
                                          @RequestParam(value = "type", required = false) String type,
                                          @RequestParam(value = "limit", required = false) Long limit,
                                          @RequestParam(value = "offset", required = false) Long offset) {
        return tenantService.list(search, status, type, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public ZhiyuTenant get(@PathVariable String id) {
        return tenantService.get(id);
    }

    @PutMapping("/{id}")
    public ZhiyuTenant update(@PathVariable String id, @RequestBody UpdateTenantRequest req) {
        return tenantService.update(id, req);
    }
}
