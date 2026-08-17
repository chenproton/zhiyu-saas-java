package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.domain.dto.system.SystemDtos.TenantAdminItem;

import java.util.List;

/**
 * 租户管理员（school_admin/enterprise_admin）服务（对齐 Go tenant_admin.go）。
 *
 * @author zhiyu
 */
public interface ISystemTenantAdminService {

    List<TenantAdminItem> list(String tenantId, String roleCode);

    TenantAdminItem get(String tenantId, String adminId, String roleCode);

    TenantAdminItem create(String tenantId, String roleCode, String role, String platform, String username, String name);

    TenantAdminItem update(String tenantId, String adminId, String roleCode, String username, String name);

    void delete(String tenantId, String adminId);

    void resetPassword(String tenantId, String adminId, String password);
}
