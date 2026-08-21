package org.dromara.zhiyu.service.system;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.mapper.system.SystemRoleMapper;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 系统管理域权限/归属校验组件（对齐 Go common.go 的 canManagePortal/canManagePlatform/
 * verifyTenantOwnership/verifyRequestTenant/requireTenant 语义）。
 *
 * <p>菜单驱动 RBAC（ADR-0008）在 Java 迁移中简化为角色码兜底：school_admin /
 * platform_admin 视为系统管理权限（自定义角色的 /portal/apps/system 菜单授权暂不支持）。</p>
 *
 * @author zhiyu
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class SystemGuard {

    public static final String ROLE_PLATFORM_ADMIN = "platform_admin";
    public static final String ROLE_SCHOOL_ADMIN = "school_admin";

    private final SystemRoleMapper roleMapper;

    /** 当前用户全部角色码（user_roles JOIN roles）。 */
    public List<String> currentRoleCodes() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            return List.of();
        }
        try {
            List<String> codes = roleMapper.selectRoleCodesByUser(userId);
            return codes == null ? List.of() : codes;
        } catch (Exception e) {
            // 权限查询失败按「无角色」降级（fail-closed 语义），但记录日志可审计
            log.warn("角色码查询失败（按无角色降级）userId={} 原因={}", userId, e.getMessage());
            return List.of();
        }
    }

    /** 当前用户是否拥有指定角色码。 */
    public boolean hasRole(String code) {
        return currentRoleCodes().contains(code);
    }

    /** 是否门户系统管理权限（school_admin/platform_admin 兜底）。 */
    public boolean canManagePortal() {
        return hasRole(ROLE_SCHOOL_ADMIN) || hasRole(ROLE_PLATFORM_ADMIN);
    }

    /** 是否用户管理权限（对齐 Go canManageUsers = canManagePortal）。 */
    public boolean canManageUsers() {
        return canManagePortal();
    }

    /** 是否平台管理员。 */
    public boolean canManagePlatform() {
        return hasRole(ROLE_PLATFORM_ADMIN);
    }

    /** 要求门户管理权限，否则 403。 */
    public void requireManagePortal() {
        if (!canManagePortal()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
    }

    /** 要求用户管理权限，否则 403。 */
    public void requireManageUsers() {
        if (!canManageUsers()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
    }

    /** 要求平台管理员权限，否则 403。 */
    public void requireManagePlatform() {
        if (!canManagePlatform()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
    }

    /** 取当前用户 ID，未登录 403。 */
    public String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    /** 取当前租户 ID，缺失 403。 */
    public String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    /** 校验实体归属（entityTenantId 必须等于当前租户）。 */
    public void verifyTenantOwnership(String entityTenantId) {
        String tenantId = requireTenant();
        if (entityTenantId != null && !entityTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
    }

    /** 校验请求体 tenantId 是否等于当前租户。 */
    public void verifyRequestTenant(String requestTenantId) {
        String tenantId = requireTenant();
        if (requestTenantId != null && !requestTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：不能为其他租户创建资源");
        }
    }
}
