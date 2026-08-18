package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemRole;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.AssignRoleRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.RoleRequest;
import org.dromara.zhiyu.service.system.ISystemRoleService;
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
 * 角色控制器（对齐 Go role_handler.go 的 /roles 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {

    private final ISystemRoleService roleService;

    @GetMapping
    public ListResponse<SystemRole> list(@RequestParam(value = "search", required = false) String search,
                                         @RequestParam(value = "status", required = false) String status,
                                         @RequestParam(value = "limit", required = false) Long limit,
                                         @RequestParam(value = "offset", required = false) Long offset) {
        return roleService.list(search, status, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public SystemRole get(@PathVariable String id) {
        return roleService.get(id);
    }

    @PostMapping
    public SystemRole create(@RequestBody RoleRequest req) {
        return roleService.create(req);
    }

    @PutMapping("/{id}")
    public SystemRole update(@PathVariable String id, @RequestBody RoleRequest req) {
        return roleService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", roleService.delete(id));
    }

    @PostMapping("/{id}/assign")
    public Map<String, String> assign(@PathVariable String id, @RequestBody AssignRoleRequest req) {
        roleService.assign(id, req.getUserId());
        return Map.of("roleId", id, "userId", req.getUserId());
    }
}
