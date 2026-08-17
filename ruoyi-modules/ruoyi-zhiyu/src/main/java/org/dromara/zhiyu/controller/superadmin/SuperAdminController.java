package org.dromara.zhiyu.controller.superadmin;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ZhiyuTenant;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.AdminEnterpriseProfile;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.AdminEnterpriseUpdateRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateTenantAdminRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateTenantRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.SetPasswordRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.TenantAdminItem;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateSubscriptionRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateTenantAdminRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateTenantRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateTenantStatusRequest;
import org.dromara.zhiyu.domain.system.SystemSubscriptionPackage;
import org.dromara.zhiyu.service.system.ISystemSettingsService;
import org.dromara.zhiyu.service.system.ISystemSuperAdminService;
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
 * 超管控制台控制器（对齐 Go registerSuperAdminRoutes 的 /admin/tenants 与 /admin/settings/theme 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/admin")
public class SuperAdminController {

    private final ISystemSuperAdminService superAdminService;
    private final ISystemSettingsService settingsService;

    @GetMapping("/tenants")
    public ListResponse<ZhiyuTenant> list(@RequestParam(value = "search", required = false) String search,
                                          @RequestParam(value = "status", required = false) String status,
                                          @RequestParam(value = "type", required = false) String type,
                                          @RequestParam(value = "limit", required = false) Long limit,
                                          @RequestParam(value = "offset", required = false) Long offset) {
        return superAdminService.adminList(search, status, type, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @PostMapping("/tenants")
    public Map<String, Object> create(@RequestBody CreateTenantRequest req) {
        return superAdminService.adminCreate(req);
    }

    @PutMapping("/tenants/{id}")
    public ZhiyuTenant update(@PathVariable String id, @RequestBody UpdateTenantRequest req) {
        return superAdminService.adminUpdate(id, req);
    }

    @PostMapping("/tenants/{id}/status")
    public ZhiyuTenant updateStatus(@PathVariable String id, @RequestBody UpdateTenantStatusRequest req) {
        return superAdminService.adminUpdateStatus(id, req.getStatus());
    }

    @DeleteMapping("/tenants/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return superAdminService.adminDelete(id);
    }

    @GetMapping("/tenants/{id}/enterprise")
    public Map<String, Object> getEnterprise(@PathVariable String id) {
        return superAdminService.adminGetEnterprise(id);
    }

    @PutMapping("/tenants/{id}/enterprise")
    public AdminEnterpriseProfile updateEnterprise(@PathVariable String id,
                                                   @RequestBody AdminEnterpriseUpdateRequest req) {
        return superAdminService.adminUpdateEnterprise(id, req);
    }

    @GetMapping("/tenants/{tenantId}/subscription")
    public SystemSubscriptionPackage getSubscription(@PathVariable String tenantId) {
        return superAdminService.adminGetSubscription(tenantId);
    }

    @PutMapping("/tenants/{tenantId}/subscription")
    public SystemSubscriptionPackage updateSubscription(@PathVariable String tenantId,
                                                        @RequestBody UpdateSubscriptionRequest req) {
        return superAdminService.adminUpdateSubscription(tenantId, req);
    }

    // ===== 学校管理员 =====

    @GetMapping("/tenants/{tenantId}/admins")
    public Map<String, Object> listAdmins(@PathVariable String tenantId) {
        var items = superAdminService.adminListAdmins(tenantId);
        return Map.of("items", items, "total", items.size());
    }

    @PostMapping("/tenants/{tenantId}/admins")
    public TenantAdminItem createAdmin(@PathVariable String tenantId, @RequestBody CreateTenantAdminRequest req) {
        return superAdminService.adminCreateAdmin(tenantId, req.getUsername(), req.getName());
    }

    @PutMapping("/tenants/{tenantId}/admins/{adminId}")
    public TenantAdminItem updateAdmin(@PathVariable String tenantId, @PathVariable String adminId,
                                       @RequestBody UpdateTenantAdminRequest req) {
        return superAdminService.adminUpdateAdmin(tenantId, adminId, req.getUsername(), req.getName());
    }

    @DeleteMapping("/tenants/{tenantId}/admins/{adminId}")
    public Map<String, String> deleteAdmin(@PathVariable String tenantId, @PathVariable String adminId) {
        return superAdminService.adminDeleteAdmin(tenantId, adminId);
    }

    @PostMapping("/tenants/{tenantId}/admins/{adminId}/reset-password")
    public Map<String, String> resetPassword(@PathVariable String tenantId, @PathVariable String adminId,
                                             @RequestBody SetPasswordRequest req) {
        return superAdminService.adminResetPassword(tenantId, adminId, req.getPassword());
    }

    // ===== 企业管理员 =====

    @GetMapping("/tenants/{tenantId}/enterprise-admins")
    public Map<String, Object> listEnterpriseAdmins(@PathVariable String tenantId) {
        var items = superAdminService.adminListEnterpriseAdmins(tenantId);
        return Map.of("items", items, "total", items.size());
    }

    @PostMapping("/tenants/{tenantId}/enterprise-admins")
    public TenantAdminItem createEnterpriseAdmin(@PathVariable String tenantId,
                                                 @RequestBody CreateTenantAdminRequest req) {
        return superAdminService.adminCreateEnterpriseAdmin(tenantId, req.getUsername(), req.getName());
    }

    @PutMapping("/tenants/{tenantId}/enterprise-admins/{adminId}")
    public TenantAdminItem updateEnterpriseAdmin(@PathVariable String tenantId, @PathVariable String adminId,
                                                 @RequestBody UpdateTenantAdminRequest req) {
        return superAdminService.adminUpdateEnterpriseAdmin(tenantId, adminId, req.getUsername(), req.getName());
    }

    @DeleteMapping("/tenants/{tenantId}/enterprise-admins/{adminId}")
    public Map<String, String> deleteEnterpriseAdmin(@PathVariable String tenantId, @PathVariable String adminId) {
        return superAdminService.adminDeleteEnterpriseAdmin(tenantId, adminId);
    }

    @PostMapping("/tenants/{tenantId}/enterprise-admins/{adminId}/reset-password")
    public Map<String, String> resetEnterprisePassword(@PathVariable String tenantId, @PathVariable String adminId,
                                                       @RequestBody SetPasswordRequest req) {
        return superAdminService.adminResetEnterprisePassword(tenantId, adminId, req.getPassword());
    }

    // ===== 主题色 =====

    @GetMapping("/settings/theme")
    public Map<String, String> getTheme() {
        return settingsService.getTheme(null);
    }

    @PutMapping("/settings/theme")
    public Map<String, String> updateTheme(@RequestBody Map<String, String> req) {
        return settingsService.updateTheme(req.get("primary"));
    }

    @PutMapping("/tenants/{tenantId}/settings/theme")
    public Map<String, String> updateTenantTheme(@PathVariable String tenantId, @RequestBody Map<String, String> req) {
        return settingsService.updateTenantTheme(tenantId, req.get("primary"));
    }

    @DeleteMapping("/tenants/{tenantId}/settings/theme")
    public Map<String, String> deleteTenantTheme(@PathVariable String tenantId) {
        return settingsService.deleteTenantTheme(tenantId);
    }
}
