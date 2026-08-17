package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateUserRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateUserRequest;
import org.dromara.zhiyu.mapper.system.SystemRoleMapper;
import org.dromara.zhiyu.mapper.system.SystemUserMapper;
import org.dromara.zhiyu.service.system.ISystemUserService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 系统用户管理服务实现（对齐 Go user_management_handler.go + store/users.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemUserServiceImpl implements ISystemUserService {

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();

    private final SystemUserMapper userMapper;
    private final SystemRoleMapper roleMapper;
    private final SystemGuard guard;

    @Override
    public ListResponse<ZhiyuUser> list(String institutionId, String roleId, String roleCode, String orgNodeId,
                                        String titleId, String status, String search, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        List<ZhiyuUser> items = userMapper.selectUserPage(tenantId, institutionId, roleId, roleCode, orgNodeId,
            titleId, status, search, safeLimit, safeOffset);
        long total = userMapper.countUsers(tenantId, institutionId, roleId, roleCode, orgNodeId, titleId, status, search);
        attachRoles(items);
        boolean manage = guard.canManageUsers();
        for (ZhiyuUser u : items) {
            mask(manage, u);
        }
        return ListResponse.of(items, total);
    }

    @Override
    public ZhiyuUser get(String id) {
        String tenantId = guard.requireTenant();
        ZhiyuUser user = userMapper.selectUserByIdAndTenant(id, tenantId);
        if (user == null) {
            throw new ApiException(404, "not_found", "用户不存在");
        }
        guard.verifyTenantOwnership(user.getTenantId());
        attachRoles(List.of(user));
        mask(guard.canManageUsers(), user);
        return user;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ZhiyuUser create(CreateUserRequest req) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        if (req.getTenantId() == null || req.getTenantId().isBlank()) {
            req.setTenantId(tenantId);
        }
        guard.verifyRequestTenant(req.getTenantId());
        if (req.getTenantId() == null || req.getTenantId().isBlank() || isBlank(req.getUsername())
            || isBlank(req.getPassword()) || isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        validateOrgMajor(req.getTenantId(), req.getOrgNodeId(), req.getMajorId());
        String platform = isBlank(req.getPlatform()) ? "portal" : req.getPlatform();
        String role = normalizeRole(req.getRole(), "school");
        String rawLoginName = isBlank(req.getLoginName()) ? req.getUsername() : req.getLoginName();
        String globalLoginName = req.getTenantId() + "_" + rawLoginName;
        String id = UUID.randomUUID().toString();
        userMapper.insertUser(id, req.getTenantId(), req.getInstitutionId(), req.getOrgNodeId(), req.getMajorId(),
            role, platform, globalLoginName, req.getUsername(), PASSWORD_ENCODER.encode(req.getPassword()),
            req.getName(), req.getEmail(), req.getPhone(), req.getAvatarUrl(), req.getStudentNo(), req.getWorkId(),
            req.getIdCard(), coalesce(req.getTitleIds()));
        if (!isBlank(req.getRoleId())) {
            bindSingleRole(id, req.getTenantId(), req.getRoleId());
        }
        return fetchOwned(req.getTenantId(), id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ZhiyuUser update(String id, UpdateUserRequest req) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        ZhiyuUser old = requireOwned(tenantId, id);
        if (isBlank(req.getUsername()) || isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        validateOrgMajor(old.getTenantId(), req.getOrgNodeId(), req.getMajorId());
        String role = normalizeRole(req.getRole(), old.getRole());
        String rawLoginName = !isBlank(req.getLoginName()) ? req.getLoginName() : req.getUsername();
        String globalLoginName = old.getTenantId() + "_" + rawLoginName;
        userMapper.updateUser(id, old.getTenantId(), req.getInstitutionId(), req.getOrgNodeId(), req.getMajorId(),
            role, globalLoginName, req.getUsername(), req.getName(), req.getEmail(), req.getPhone(),
            req.getAvatarUrl(), req.getStudentNo(), req.getWorkId(), req.getIdCard(), coalesce(req.getTitleIds()));
        if (!isBlank(req.getRoleId())) {
            rebindSingleRole(id, req.getRoleId(), old.getTenantId());
        }
        return fetchOwned(old.getTenantId(), id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        ZhiyuUser user = requireOwned(tenantId, id);
        roleMapper.decrementUserCountsByUser(id);
        roleMapper.deleteUserRolesByUser(id);
        userMapper.deleteUser(id, user.getTenantId());
        return id;
    }

    @Override
    public ZhiyuUser updateStatus(String id, String status) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        ZhiyuUser user = requireOwned(tenantId, id);
        if (!"active".equals(status) && !"disabled".equals(status) && !"graduated".equals(status)) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        userMapper.updateStatus(id, user.getTenantId(), status);
        return fetchOwned(user.getTenantId(), id);
    }

    @Override
    public ZhiyuUser resetPassword(String id, String password) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        ZhiyuUser user = requireOwned(tenantId, id);
        validateStrongPassword(password);
        userMapper.resetPassword(id, user.getTenantId(), PASSWORD_ENCODER.encode(password));
        return fetchOwned(user.getTenantId(), id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ListResponse<ZhiyuUser> batchCreate(List<CreateUserRequest> users) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        if (users == null || users.isEmpty()) {
            throw new ApiException(400, "bad_request", "用户列表不能为空");
        }
        List<ZhiyuUser> created = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (CreateUserRequest u : users) {
            if (u.getTenantId() == null || u.getTenantId().isBlank()) {
                u.setTenantId(tenantId);
            }
            guard.verifyRequestTenant(u.getTenantId());
            if (isBlank(u.getTenantId()) || isBlank(u.getUsername()) || isBlank(u.getPassword()) || isBlank(u.getName())) {
                continue;
            }
            String dedupKey = u.getTenantId() + ":" + (isBlank(u.getPlatform()) ? "portal" : u.getPlatform())
                + ":" + u.getUsername();
            if (!seen.add(dedupKey)) {
                continue;
            }
            String platform = isBlank(u.getPlatform()) ? "portal" : u.getPlatform();
            String role = normalizeRole(u.getRole(), "school");
            String rawLoginName = isBlank(u.getLoginName()) ? u.getUsername() : u.getLoginName();
            String id = UUID.randomUUID().toString();
            userMapper.insertUser(id, u.getTenantId(), u.getInstitutionId(), u.getOrgNodeId(), u.getMajorId(),
                role, platform, u.getTenantId() + "_" + rawLoginName, u.getUsername(),
                PASSWORD_ENCODER.encode(u.getPassword()), u.getName(), u.getEmail(), u.getPhone(), u.getAvatarUrl(),
                u.getStudentNo(), u.getWorkId(), u.getIdCard(), coalesce(u.getTitleIds()));
            if (!isBlank(u.getRoleId())) {
                bindSingleRole(id, u.getTenantId(), u.getRoleId());
            }
            ZhiyuUser createdUser = fetchOwned(u.getTenantId(), id);
            createdUser.setIdCard(null);
            created.add(createdUser);
        }
        return ListResponse.of(created, created.size());
    }

    @Override
    public long batchGraduate(List<String> userIds, Integer graduateYear) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        validateUuids(userIds);
        int year = graduateYear == null ? java.time.Year.now().getValue() : graduateYear;
        userMapper.batchGraduate(tenantId, userIds, year);
        return userIds.size();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public long batchDelete(List<String> userIds) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        validateUuids(userIds);
        for (String id : userIds) {
            roleMapper.decrementUserCountsByUser(id);
            roleMapper.deleteUserRolesByUser(id);
        }
        userMapper.batchDeleteUsers(tenantId, userIds);
        return userIds.size();
    }

    @Override
    public long batchUpdateOrgNode(List<String> userIds, String orgNodeId) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        validateUuids(userIds);
        if (!isBlank(orgNodeId) && !userMapper.orgNodeExists(orgNodeId, tenantId)) {
            throw new ApiException(400, "bad_request", "无效机构节点ID");
        }
        userMapper.batchUpdateOrgNode(tenantId, userIds, orgNodeId);
        return userIds.size();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ZhiyuUser bindRoles(String id, List<String> roleIds) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        ZhiyuUser user = requireOwned(tenantId, id);
        List<String> unique = uniqueStrings(roleIds);
        if (unique.isEmpty()) {
            throw new ApiException(400, "bad_request", "至少需要绑定一个角色");
        }
        if (userMapper.countRolesInTenant(user.getTenantId(), unique) != unique.size()) {
            throw new ApiException(400, "bad_request", "存在无效角色或角色不属于当前租户");
        }
        roleMapper.decrementUserCountsByUser(id);
        roleMapper.deleteUserRolesByUser(id);
        List<String> inserted = new ArrayList<>();
        for (String roleId : unique) {
            int rows = roleMapper.insertUserRole(UUID.randomUUID().toString(), id, roleId);
            if (rows > 0) {
                inserted.add(roleId);
            }
        }
        for (String roleId : inserted) {
            roleMapper.incrementUserCount(roleId, user.getTenantId());
        }
        ZhiyuUser updated = fetchOwned(user.getTenantId(), id);
        attachRoles(List.of(updated));
        return updated;
    }

    // ---------- 内部 ----------

    private void bindSingleRole(String userId, String tenantId, String roleId) {
        int valid = userMapper.countRolesInTenant(tenantId, List.of(roleId));
        if (valid != 1) {
            throw new ApiException(400, "bad_request", "存在无效角色或角色不属于当前租户");
        }
        int rows = roleMapper.insertUserRole(UUID.randomUUID().toString(), userId, roleId);
        if (rows > 0) {
            roleMapper.incrementUserCount(roleId, tenantId);
        }
    }

    private void rebindSingleRole(String userId, String roleId, String tenantId) {
        int valid = userMapper.countRolesInTenant(tenantId, List.of(roleId));
        if (valid != 1) {
            throw new ApiException(400, "bad_request", "存在无效角色或角色不属于当前租户");
        }
        roleMapper.decrementUserCountsByUser(userId);
        roleMapper.deleteUserRolesByUser(userId);
        roleMapper.insertUserRole(UUID.randomUUID().toString(), userId, roleId);
        roleMapper.incrementUserCount(roleId, tenantId);
    }

    private void validateOrgMajor(String tenantId, String orgNodeId, String majorId) {
        if (!isBlank(orgNodeId) && !userMapper.orgNodeExists(orgNodeId, tenantId)) {
            throw new ApiException(400, "bad_request", "无效机构节点ID");
        }
        if (!isBlank(majorId) && !userMapper.majorExists(majorId, tenantId)) {
            throw new ApiException(400, "bad_request", "专业 ID 无效");
        }
    }

    private ZhiyuUser requireOwned(String tenantId, String id) {
        ZhiyuUser user = userMapper.selectUserByIdAndTenant(id, tenantId);
        if (user == null) {
            throw new ApiException(404, "not_found", "用户不存在");
        }
        guard.verifyTenantOwnership(user.getTenantId());
        return user;
    }

    private ZhiyuUser fetchOwned(String tenantId, String id) {
        ZhiyuUser user = userMapper.selectUserByIdAndTenant(id, tenantId);
        if (user == null) {
            throw new ApiException(500, "internal_error", "查询用户失败");
        }
        return user;
    }

    private void attachRoles(List<ZhiyuUser> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        List<String> ids = items.stream().map(ZhiyuUser::getId).filter(java.util.Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<String, ZhiyuUser> index = new LinkedHashMap<>();
        for (ZhiyuUser u : items) {
            index.put(u.getId(), u);
        }
        List<Map<String, Object>> rows = roleMapper.selectUserRoleRefs(ids);
        for (Map<String, Object> row : rows) {
            String userId = String.valueOf(row.get("user_id"));
            ZhiyuUser u = index.get(userId);
            if (u == null) {
                continue;
            }
            if (u.getRoleIds() == null) {
                u.setRoleIds(new ArrayList<>());
                u.setRoleCodes(new ArrayList<>());
                u.setRoleNames(new ArrayList<>());
            }
            u.getRoleIds().add(str(row.get("id")));
            u.getRoleCodes().add(str(row.get("code")));
            u.getRoleNames().add(str(row.get("name")));
        }
    }

    private void mask(boolean manage, ZhiyuUser u) {
        if (u == null || manage) {
            return;
        }
        u.setPhone(maskPhone(u.getPhone()));
        u.setEmail(maskEmail(u.getEmail()));
        u.setIdCard(maskIdCard(u.getIdCard()));
        u.setStudentNo(maskCode(u.getStudentNo()));
        u.setWorkId(maskCode(u.getWorkId()));
    }

    private String maskPhone(String s) {
        if (s == null || s.length() < 7) {
            return s == null || s.isEmpty() ? s : "******";
        }
        return s.substring(0, 3) + "****" + s.substring(s.length() - 4);
    }

    private String maskIdCard(String s) {
        if (s == null || s.length() <= 6) {
            return s == null || s.isEmpty() ? s : "******";
        }
        return s.substring(0, 3) + "********" + s.substring(s.length() - 3);
    }

    private String maskEmail(String s) {
        if (s == null) {
            return null;
        }
        int at = s.indexOf('@');
        if (at <= 1) {
            return "***";
        }
        return s.substring(0, 1) + "***" + s.substring(at);
    }

    private String maskCode(String s) {
        if (s == null || s.length() <= 4) {
            return s == null || s.isEmpty() ? s : "****";
        }
        return s.substring(0, 2) + "****" + s.substring(s.length() - 2);
    }

    private String normalizeRole(String role, String fallback) {
        if ("school".equals(role) || "enterprise".equals(role) || "operator".equals(role)) {
            return role;
        }
        return fallback;
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

    private void validateUuids(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少用户ID列表");
        }
        for (String id : ids) {
            try {
                UUID.fromString(id);
            } catch (IllegalArgumentException e) {
                throw new ApiException(400, "bad_request", "无效用户ID: " + id);
            }
        }
    }

    private List<String> uniqueStrings(List<String> items) {
        LinkedHashSet<String> set = new LinkedHashSet<>();
        if (items != null) {
            for (String s : items) {
                if (s != null && !s.isBlank()) {
                    set.add(s);
                }
            }
        }
        return new ArrayList<>(set);
    }

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }
}
