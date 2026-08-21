package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuTenant;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.TenantAdminItem;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateTenantRequest;
import org.dromara.zhiyu.domain.system.SystemSubscriptionPackage;
import org.dromara.zhiyu.mapper.system.SystemSubscriptionMapper;
import org.dromara.zhiyu.mapper.system.SystemTenantMapper;
import org.dromara.zhiyu.service.system.ISystemTenantAdminService;
import org.dromara.zhiyu.service.system.ISystemTenantService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 门户侧租户/管理员/订阅服务实现（对齐 Go tenant_handler.go 门户组 + subscription_handler.Get）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemTenantServiceImpl implements ISystemTenantService {

    private final SystemTenantMapper tenantMapper;
    private final SystemSubscriptionMapper subscriptionMapper;
    private final ISystemTenantAdminService adminService;
    private final SystemGuard guard;

    @Override
    public ListResponse<ZhiyuTenant> list(String search, String status, String type, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = guard.clampLimit(limit, 50);
        LambdaQueryBuilder<ZhiyuTenant> wrapper = QueryBuilder.lambda(ZhiyuTenant.class)
            .eq(ZhiyuTenant::getId, tenantId);
        if (status != null && !status.isBlank()) {
            wrapper.eq(ZhiyuTenant::getStatus, status);
        }
        if (type != null && !type.isBlank()) {
            wrapper.eq(ZhiyuTenant::getType, type);
        }
        if (search != null && !search.isBlank()) {
            wrapper.and(w -> w.like(ZhiyuTenant::getName, search).or().like(ZhiyuTenant::getCode, search));
        }
        long total = tenantMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(ZhiyuTenant::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<ZhiyuTenant> items = tenantMapper.selectList(wrapper.build());
        return ListResponse.of(items, total);
    }

    @Override
    public ZhiyuTenant get(String id) {
        ZhiyuTenant tenant = tenantMapper.selectById(id);
        if (tenant == null) {
            throw new ApiException(404, "not_found", "租户不存在");
        }
        if (!guard.canManagePlatform()) {
            String tenantId = guard.requireTenant();
            if (!tenantId.equals(tenant.getId())) {
                throw new ApiException(403, "forbidden", "只能查看自己的租户");
            }
        }
        return tenant;
    }

    @Override
    public ZhiyuTenant update(String id, UpdateTenantRequest req) {
        if (!guard.canManagePortal() && !guard.canManagePlatform()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        if (!guard.canManagePlatform()) {
            String tenantId = guard.requireTenant();
            if (!tenantId.equals(id)) {
                throw new ApiException(403, "forbidden", "只能更新自己的租户");
            }
        }
        if (tenantMapper.selectById(id) == null) {
            throw new ApiException(404, "not_found", "租户不存在");
        }
        if (req.getName() == null || req.getName().isBlank()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 有效期仅平台管理员可改
        String validFrom = guard.canManagePlatform() ? req.getValidFrom() : null;
        String validUntil = guard.canManagePlatform() ? req.getValidUntil() : null;
        tenantMapper.updateTenant(id, req.getName(), req.getLogoUrl(), req.getDomain(), req.getEnterpriseCode(),
            req.getContact(), req.getPhone(), req.getAddress(), req.getDescription(), req.getShortName(),
            req.getSchoolType(), req.getProvince(), req.getCity(), req.getWebsite(), req.getContactPhone(),
            req.getScaleData(), req.getSecondaryColleges(), req.getEducationLevel(), req.getEducationNature(),
            validFrom, validUntil);
        return tenantMapper.selectById(id);
    }

    @Override
    public List<TenantAdminItem> listSchoolAdmins() {
        String tenantId = guard.requireTenant();
        return adminService.list(tenantId, "school_admin");
    }

    @Override
    public TenantAdminItem createSchoolAdmin(String username, String name) {
        String tenantId = guard.requireTenant();
        if (isBlank(username) || isBlank(name)) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        return adminService.create(tenantId, "school_admin", "school", "portal", username, name);
    }

    @Override
    public TenantAdminItem updateSchoolAdmin(String id, String username, String name) {
        String tenantId = guard.requireTenant();
        if (adminService.get(tenantId, id, "school_admin") == null) {
            throw new ApiException(404, "not_found", "管理员不存在");
        }
        if (isBlank(username) || isBlank(name)) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        return adminService.update(tenantId, id, "school_admin", username, name);
    }

    @Override
    public String deleteSchoolAdmin(String id) {
        String tenantId = guard.requireTenant();
        if (adminService.get(tenantId, id, "school_admin") == null) {
            throw new ApiException(404, "not_found", "管理员不存在");
        }
        adminService.delete(tenantId, id);
        return id;
    }

    @Override
    public String resetSchoolAdminPassword(String id, String password) {
        String tenantId = guard.requireTenant();
        if (adminService.get(tenantId, id, "school_admin") == null) {
            throw new ApiException(404, "not_found", "管理员不存在");
        }
        validateStrongPassword(password);
        adminService.resetPassword(tenantId, id, password);
        return id;
    }

    @Override
    public SystemSubscriptionPackage getSubscription() {
        String tenantId = guard.requireTenant();
        SystemSubscriptionPackage sub = subscriptionMapper.selectByTenant(tenantId);
        if (sub == null) {
            throw new ApiException(404, "not_found", "订阅不存在");
        }
        return sub;
    }

    private void validateStrongPassword(String password) {
        if (password == null || password.length() < 8) {
            throw new ApiException(400, "bad_request", "密码长度至少 8 位，且需同时包含字母和数字");
        }
        boolean letter = false;
        boolean digit = false;
        for (char c : password.toCharArray()) {
            if (Character.isLetter(c)) {
                letter = true;
            } else if (Character.isDigit(c)) {
                digit = true;
            }
        }
        if (!letter || !digit) {
            throw new ApiException(400, "bad_request", "密码长度至少 8 位，且需同时包含字母和数字");
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

}
