package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.TenantAdminItem;
import org.dromara.zhiyu.mapper.system.SystemTenantAdminMapper;
import org.dromara.zhiyu.service.system.ISystemTenantAdminService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;

/**
 * 租户管理员服务实现（对齐 Go service/tenant_admin.go + store/tenant_admins.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemTenantAdminServiceImpl implements ISystemTenantAdminService {

    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private final SystemTenantAdminMapper adminMapper;

    @Override
    public List<TenantAdminItem> list(String tenantId, String roleCode) {
        return adminMapper.listAdmins(tenantId, roleCode);
    }

    @Override
    public TenantAdminItem get(String tenantId, String adminId, String roleCode) {
        return adminMapper.getAdmin(tenantId, adminId, roleCode);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TenantAdminItem create(String tenantId, String roleCode, String role, String platform,
                                  String username, String name) {
        String plainPassword = securePassword(12);
        String id = UUID.randomUUID().toString();
        String loginName = tenantId + "_" + username;
        adminMapper.insertAdmin(id, tenantId, role, platform, loginName, username,
            PASSWORD_ENCODER.encode(plainPassword), name);
        int roleRows = adminMapper.insertAdminRole(UUID.randomUUID().toString(), id, tenantId, roleCode);
        if (roleRows == 0) {
            throw new ApiException(500, "internal_error", "租户内不存在角色: " + roleCode);
        }
        adminMapper.incrementRoleCount(tenantId, roleCode);
        // admin_ids 追加新管理员（幂等），保证 tenants.admin_ids 与真实管理员一致（前端按此统计管理员数量）
        adminMapper.appendAdminIds(tenantId, id);
        TenantAdminItem admin = adminMapper.getAdmin(tenantId, id, roleCode);
        admin.setNewPassword(plainPassword);
        return admin;
    }

    @Override
    public TenantAdminItem update(String tenantId, String adminId, String roleCode, String username, String name) {
        adminMapper.updateAdmin(tenantId, adminId, username, tenantId + "_" + username, name);
        return adminMapper.getAdmin(tenantId, adminId, roleCode);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(String tenantId, String adminId) {
        adminMapper.decrementAdminRoleCount(tenantId, adminId);
        adminMapper.deleteAdminRoles(tenantId, adminId);
        adminMapper.removeFromAdminIds(tenantId, adminId);
        adminMapper.deleteAdmin(tenantId, adminId);
    }

    @Override
    public void resetPassword(String tenantId, String adminId, String password) {
        adminMapper.resetPassword(tenantId, adminId, PASSWORD_ENCODER.encode(password));
    }

    private String securePassword(int length) {
        byte[] bytes = new byte[length];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(HEX[(b >> 4) & 0xf]).append(HEX[b & 0xf]);
        }
        return sb.toString();
    }
}
