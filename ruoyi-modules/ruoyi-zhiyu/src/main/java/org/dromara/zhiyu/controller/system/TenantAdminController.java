package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateTenantAdminRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.SetPasswordRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.TenantAdminItem;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateTenantAdminRequest;
import org.dromara.zhiyu.service.system.ISystemTenantService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 门户侧学校管理员控制器（对齐 Go registerPortalRoutes 的 /admins 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/admins")
public class TenantAdminController {

    private final ISystemTenantService tenantService;

    @GetMapping
    public Map<String, Object> list() {
        var items = tenantService.listSchoolAdmins();
        return Map.of("items", items, "total", items.size());
    }

    @PostMapping
    public TenantAdminItem create(@RequestBody CreateTenantAdminRequest req) {
        return tenantService.createSchoolAdmin(req.getUsername(), req.getName());
    }

    @PutMapping("/{id}")
    public TenantAdminItem update(@PathVariable String id, @RequestBody UpdateTenantAdminRequest req) {
        return tenantService.updateSchoolAdmin(id, req.getUsername(), req.getName());
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        tenantService.deleteSchoolAdmin(id);
        return Map.of("id", id, "deleted", "true");
    }

    @PostMapping("/{id}/reset-password")
    public Map<String, String> resetPassword(@PathVariable String id, @RequestBody SetPasswordRequest req) {
        tenantService.resetSchoolAdminPassword(id, req.getPassword());
        return Map.of("id", id, "updated", "true");
    }
}
