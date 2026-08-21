package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.system.SystemRole;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.RoleRequest;
import org.dromara.zhiyu.mapper.system.SystemRoleMapper;
import org.dromara.zhiyu.mapper.system.SystemUserMapper;
import org.dromara.zhiyu.service.system.ISystemRoleService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 角色服务实现（对齐 Go role_handler.go + store/roles.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemRoleServiceImpl implements ISystemRoleService {

    private final SystemRoleMapper roleMapper;
    private final SystemUserMapper userMapper;
    private final SystemGuard guard;

    @Override
    public ListResponse<SystemRole> list(String search, String status, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = guard.clampLimit(limit, 50);
        LambdaQueryBuilder<SystemRole> wrapper = QueryBuilder.lambda(SystemRole.class)
            .eq(SystemRole::getTenantId, tenantId);
        if (status != null && !status.isBlank()) {
            wrapper.eq(SystemRole::getStatus, status);
        }
        if (search != null && !search.isBlank()) {
            wrapper.and(w -> w.like(SystemRole::getName, search).or().like(SystemRole::getCode, search));
        }
        long total = roleMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SystemRole::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<SystemRole> items = roleMapper.selectList(wrapper.build());
        return ListResponse.of(items, total);
    }

    @Override
    public SystemRole get(String id) {
        SystemRole role = roleMapper.selectById(id);
        if (role == null) {
            throw new ApiException(404, "not_found", "角色不存在");
        }
        guard.verifyTenantOwnership(role.getTenantId());
        return role;
    }

    @Override
    public SystemRole create(RoleRequest req) {
        guard.requireManagePortal();
        if (isBlank(req.getTenantId()) || isBlank(req.getCode()) || isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        guard.verifyRequestTenant(req.getTenantId());
        String id = UUID.randomUUID().toString();
        roleMapper.insertRole(id, req.getTenantId(), req.getCode(), req.getName(), req.getDescription(), req.getPermissions());
        return roleMapper.selectById(id);
    }

    @Override
    public SystemRole update(String id, RoleRequest req) {
        guard.requireManagePortal();
        requireOwned(id);
        if (isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        roleMapper.updateRole(id, req.getName(), req.getDescription(), req.getPermissions());
        return roleMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        guard.requireManagePortal();
        requireOwned(id);
        roleMapper.deleteUserRoles(id);
        roleMapper.deleteRole(id);
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String assign(String id, String userId) {
        guard.requireManagePortal();
        SystemRole role = requireOwned(id);
        if (isBlank(userId)) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        var user = userMapper.selectById(userId);
        if (user == null) {
            throw new ApiException(404, "not_found", "用户不存在");
        }
        guard.verifyTenantOwnership(user.getTenantId());
        roleMapper.insertUserRole(UUID.randomUUID().toString(), userId, id);
        roleMapper.incrementUserCount(id, role.getTenantId());
        return id;
    }

    private SystemRole requireOwned(String id) {
        SystemRole role = roleMapper.selectById(id);
        if (role == null) {
            throw new ApiException(404, "not_found", "角色不存在");
        }
        guard.verifyTenantOwnership(role.getTenantId());
        return role;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

}
