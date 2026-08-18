package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ZhiyuTenant;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.AdminEnterpriseProfile;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.AdminEnterpriseUpdateRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateTenantRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.TenantAdminItem;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateSubscriptionRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateTenantRequest;
import org.dromara.zhiyu.domain.system.SystemSubscriptionPackage;

import java.util.List;
import java.util.Map;

/**
 * 超管控制台服务（对齐 Go tenant_handler.go 的 /admin/tenants 组 + subscription_handler 的 AdminGet/AdminUpdate）。
 *
 * @author zhiyu
 */
public interface ISystemSuperAdminService {

    ListResponse<ZhiyuTenant> adminList(String search, String status, String type, long limit, long offset);

    Map<String, Object> adminCreate(CreateTenantRequest req);

    ZhiyuTenant adminUpdate(String id, UpdateTenantRequest req);

    ZhiyuTenant adminUpdateStatus(String id, String status);

    Map<String, String> adminDelete(String id);

    Map<String, Object> adminGetEnterprise(String id);

    AdminEnterpriseProfile adminUpdateEnterprise(String id, AdminEnterpriseUpdateRequest req);

    List<TenantAdminItem> adminListAdmins(String tenantId);

    TenantAdminItem adminCreateAdmin(String tenantId, String username, String name);

    TenantAdminItem adminUpdateAdmin(String tenantId, String adminId, String username, String name);

    Map<String, String> adminDeleteAdmin(String tenantId, String adminId);

    Map<String, String> adminResetPassword(String tenantId, String adminId, String password);

    List<TenantAdminItem> adminListEnterpriseAdmins(String tenantId);

    TenantAdminItem adminCreateEnterpriseAdmin(String tenantId, String username, String name);

    TenantAdminItem adminUpdateEnterpriseAdmin(String tenantId, String adminId, String username, String name);

    Map<String, String> adminDeleteEnterpriseAdmin(String tenantId, String adminId);

    Map<String, String> adminResetEnterprisePassword(String tenantId, String adminId, String password);

    SystemSubscriptionPackage adminGetSubscription(String tenantId);

    SystemSubscriptionPackage adminUpdateSubscription(String tenantId, UpdateSubscriptionRequest req);
}
