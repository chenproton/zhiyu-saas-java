package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuTenant;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.AdminEnterpriseProfile;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.AdminEnterpriseUpdateRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.AdminUserInfo;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateTenantRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.TenantAdminItem;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateSubscriptionRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateTenantRequest;
import org.dromara.zhiyu.domain.system.SystemSubscriptionPackage;
import org.dromara.zhiyu.mapper.system.SystemEnterpriseMapper;
import org.dromara.zhiyu.mapper.system.SystemOrgTypeMapper;
import org.dromara.zhiyu.mapper.system.SystemRoleMapper;
import org.dromara.zhiyu.mapper.system.SystemSubscriptionMapper;
import org.dromara.zhiyu.mapper.system.SystemTenantAdminMapper;
import org.dromara.zhiyu.mapper.system.SystemTenantMapper;
import org.dromara.zhiyu.mapper.system.SystemUserMapper;
import org.dromara.zhiyu.service.system.ISystemSuperAdminService;
import org.dromara.zhiyu.service.system.ISystemTenantAdminService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 超管控制台服务实现（对齐 Go tenant_handler.go /admin/tenants 组 + subscription_handler Admin*）。
 *
 * <p>说明：新建租户默认资源仅实现套餐/组织类型/角色/管理员（行业与联盟字典种子数据暂未移植，
 * 见交付报告）。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemSuperAdminServiceImpl implements ISystemSuperAdminService {

    private static final String OPERATOR_TENANT_ID = "00000000-0000-0000-0000-000000000001";
    private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private final SystemTenantMapper tenantMapper;
    private final SystemTenantAdminMapper adminMapper;
    private final SystemSubscriptionMapper subscriptionMapper;
    private final SystemOrgTypeMapper orgTypeMapper;
    private final SystemRoleMapper roleMapper;
    private final SystemUserMapper userMapper;
    private final SystemEnterpriseMapper enterpriseMapper;
    private final ISystemTenantAdminService adminService;
    private final SystemGuard guard;

    @Override
    public ListResponse<ZhiyuTenant> adminList(String search, String status, String type, long limit, long offset) {
        guard.requireManagePlatform();
        long safeLimit = clampLimit(limit, 20);
        LambdaQueryBuilder<ZhiyuTenant> wrapper = QueryBuilder.lambda(ZhiyuTenant.class)
            .ne(ZhiyuTenant::getId, OPERATOR_TENANT_ID);
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
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> adminCreate(CreateTenantRequest req) {
        guard.requireManagePlatform();
        if (req.getName() == null || req.getName().isBlank()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if ("enterprise".equals(req.getType())) {
            return createEnterpriseTenant(req);
        }
        if (req.getCode() == null || req.getCode().isBlank()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        return createSchoolTenant(req);
    }

    @Override
    public ZhiyuTenant adminUpdate(String id, UpdateTenantRequest req) {
        guard.requireManagePlatform();
        if (tenantMapper.selectById(id) == null) {
            throw new ApiException(404, "not_found", "租户不存在");
        }
        if (req.getName() == null || req.getName().isBlank()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        tenantMapper.updateTenant(id, req.getName(), req.getLogoUrl(), req.getDomain(), req.getEnterpriseCode(),
            req.getContact(), req.getPhone(), req.getAddress(), req.getDescription(), req.getShortName(),
            req.getSchoolType(), req.getProvince(), req.getCity(), req.getWebsite(), req.getContactPhone(),
            req.getScaleData(), req.getSecondaryColleges(), req.getEducationLevel(), req.getEducationNature(),
            req.getValidFrom(), req.getValidUntil());
        return tenantMapper.selectById(id);
    }

    @Override
    public ZhiyuTenant adminUpdateStatus(String id, String status) {
        guard.requireManagePlatform();
        if (tenantMapper.selectById(id) == null) {
            throw new ApiException(404, "not_found", "租户不存在");
        }
        if (!"active".equals(status) && !"inactive".equals(status)) {
            throw new ApiException(400, "bad_request", "无效状态");
        }
        tenantMapper.updateStatus(id, status);
        return tenantMapper.selectById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, String> adminDelete(String id) {
        guard.requireManagePlatform();
        if (tenantMapper.selectById(id) == null) {
            throw new ApiException(404, "not_found", "租户不存在");
        }
        tenantMapper.deleteTenantUsers(id);
        tenantMapper.deleteTenant(id);
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("id", id);
        resp.put("deleted", "true");
        return resp;
    }

    @Override
    public Map<String, Object> adminGetEnterprise(String id) {
        guard.requireManagePlatform();
        ZhiyuTenant tenant = tenantMapper.selectById(id);
        if (tenant == null) {
            throw new ApiException(404, "not_found", "租户不存在");
        }
        if (!"enterprise".equals(tenant.getType())) {
            throw new ApiException(400, "bad_request", "非企业租户");
        }
        AdminEnterpriseProfile profile = enterpriseMapper.selectByTenant(id);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("tenant", tenant);
        resp.put("enterprise", profile);
        return resp;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminEnterpriseProfile adminUpdateEnterprise(String id, AdminEnterpriseUpdateRequest req) {
        guard.requireManagePlatform();
        ZhiyuTenant tenant = tenantMapper.selectById(id);
        if (tenant == null) {
            throw new ApiException(404, "not_found", "租户不存在");
        }
        if (!"enterprise".equals(tenant.getType())) {
            throw new ApiException(400, "bad_request", "非企业租户");
        }
        AdminEnterpriseProfile existing = enterpriseMapper.selectByTenant(id);
        if (existing == null) {
            throw new ApiException(500, "internal_error", "查询企业信息失败");
        }
        String name = isBlank(req.getName()) ? existing.getName() : req.getName();
        String creditCode = isBlank(req.getUnifiedSocialCreditCode()) ? existing.getUnifiedSocialCreditCode()
            : req.getUnifiedSocialCreditCode();
        String contactPerson = isBlank(req.getContactPerson()) ? existing.getContactPerson() : req.getContactPerson();
        String contactPhone = isBlank(req.getContactPhone()) ? existing.getContactPhone() : req.getContactPhone();
        String contactEmail = isBlank(req.getContactEmail()) ? existing.getContactEmail() : req.getContactEmail();
        Boolean enablePublic = req.getEnablePublic() == null ? existing.getEnablePublic() : req.getEnablePublic();

        enterpriseMapper.updateEnterprise(existing.getId(), name, creditCode, contactPerson, contactPhone,
            contactEmail, enablePublic);

        String validFrom = req.getValidFrom() == null ? tenant.getValidFrom() : emptyToNull(req.getValidFrom());
        String validUntil = req.getValidUntil() == null ? tenant.getValidUntil() : emptyToNull(req.getValidUntil());
        tenantMapper.updateTenant(id, name, tenant.getLogoUrl(), tenant.getDomain(), creditCode, contactPerson,
            contactPhone, tenant.getAddress(), tenant.getDescription(), tenant.getShortName(), tenant.getSchoolType(),
            tenant.getProvince(), tenant.getCity(), tenant.getWebsite(), tenant.getContactPhone(),
            tenant.getScaleData(), tenant.getSecondaryColleges(), tenant.getEducationLevel(), tenant.getEducationNature(),
            validFrom, validUntil);

        if (!isBlank(req.getStatus())) {
            if (!"active".equals(req.getStatus()) && !"inactive".equals(req.getStatus())) {
                throw new ApiException(400, "bad_request", "无效状态");
            }
            tenantMapper.updateStatus(id, req.getStatus());
        }
        return enterpriseMapper.selectByTenant(id);
    }

    // ===== 学校管理员（/admin/tenants/{tenantId}/admins） =====

    @Override
    public List<TenantAdminItem> adminListAdmins(String tenantId) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        return adminService.list(tenantId, "school_admin");
    }

    @Override
    public TenantAdminItem adminCreateAdmin(String tenantId, String username, String name) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        if (isBlank(username) || isBlank(name)) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        return adminService.create(tenantId, "school_admin", "school", "portal", username, name);
    }

    @Override
    public TenantAdminItem adminUpdateAdmin(String tenantId, String adminId, String username, String name) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        if (adminService.get(tenantId, adminId, "school_admin") == null) {
            throw new ApiException(404, "not_found", "管理员不存在");
        }
        if (isBlank(username) || isBlank(name)) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        return adminService.update(tenantId, adminId, "school_admin", username, name);
    }

    @Override
    public Map<String, String> adminDeleteAdmin(String tenantId, String adminId) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        if (adminService.get(tenantId, adminId, "school_admin") == null) {
            throw new ApiException(404, "not_found", "管理员不存在");
        }
        adminService.delete(tenantId, adminId);
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("id", adminId);
        resp.put("deleted", "true");
        return resp;
    }

    @Override
    public Map<String, String> adminResetPassword(String tenantId, String adminId, String password) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        if (adminService.get(tenantId, adminId, "school_admin") == null) {
            throw new ApiException(404, "not_found", "管理员不存在");
        }
        validateStrongPassword(password);
        adminService.resetPassword(tenantId, adminId, password);
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("id", adminId);
        resp.put("updated", "true");
        return resp;
    }

    // ===== 企业管理员（/admin/tenants/{tenantId}/enterprise-admins） =====

    @Override
    public List<TenantAdminItem> adminListEnterpriseAdmins(String tenantId) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        return adminService.list(tenantId, "enterprise_admin");
    }

    @Override
    public TenantAdminItem adminCreateEnterpriseAdmin(String tenantId, String username, String name) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        if (isBlank(username) || isBlank(name)) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        return adminService.create(tenantId, "enterprise_admin", "enterprise", "partner", username, name);
    }

    @Override
    public TenantAdminItem adminUpdateEnterpriseAdmin(String tenantId, String adminId, String username, String name) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        if (adminService.get(tenantId, adminId, "enterprise_admin") == null) {
            throw new ApiException(404, "not_found", "管理员不存在");
        }
        if (isBlank(username) || isBlank(name)) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        return adminService.update(tenantId, adminId, "enterprise_admin", username, name);
    }

    @Override
    public Map<String, String> adminDeleteEnterpriseAdmin(String tenantId, String adminId) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        if (adminService.get(tenantId, adminId, "enterprise_admin") == null) {
            throw new ApiException(404, "not_found", "管理员不存在");
        }
        adminService.delete(tenantId, adminId);
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("id", adminId);
        resp.put("deleted", "true");
        return resp;
    }

    @Override
    public Map<String, String> adminResetEnterprisePassword(String tenantId, String adminId, String password) {
        guard.requireManagePlatform();
        requireTenant(tenantId);
        if (adminService.get(tenantId, adminId, "enterprise_admin") == null) {
            throw new ApiException(404, "not_found", "管理员不存在");
        }
        validateStrongPassword(password);
        adminService.resetPassword(tenantId, adminId, password);
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("id", adminId);
        resp.put("updated", "true");
        return resp;
    }

    // ===== 订阅 =====

    @Override
    public SystemSubscriptionPackage adminGetSubscription(String tenantId) {
        guard.requireManagePlatform();
        SystemSubscriptionPackage sub = subscriptionMapper.selectByTenant(tenantId);
        if (sub == null) {
            SystemSubscriptionPackage empty = new SystemSubscriptionPackage();
            empty.setTenantId(tenantId);
            empty.setName("");
            empty.setModules(new LinkedHashMap<>());
            empty.setStatus("inactive");
            return empty;
        }
        return sub;
    }

    @Override
    public SystemSubscriptionPackage adminUpdateSubscription(String tenantId, UpdateSubscriptionRequest req) {
        guard.requireManagePlatform();
        Map<String, Object> modules = req.getModules() == null ? new LinkedHashMap<>() : req.getModules();
        SystemSubscriptionPackage existing = subscriptionMapper.selectByTenant(tenantId);
        if (existing != null && existing.getId() != null) {
            String name = isBlank(req.getName()) ? existing.getName() : req.getName();
            String status = isBlank(req.getStatus()) ? existing.getStatus() : req.getStatus();
            String validUntil = req.getValidUntil() == null ? existing.getValidUntil() : req.getValidUntil();
            subscriptionMapper.updateSubscription(existing.getId(), name, validUntil, modules, status, req.getAiTokenQuota());
            return subscriptionMapper.selectByTenant(tenantId);
        }
        String name = isBlank(req.getName()) ? "默认套餐" : req.getName();
        String status = isBlank(req.getStatus()) ? "active" : req.getStatus();
        subscriptionMapper.insertSubscription(UUID.randomUUID().toString(), tenantId, name, req.getValidUntil(), modules,
            status, req.getAiTokenQuota());
        return subscriptionMapper.selectByTenant(tenantId);
    }

    // ===== 内部 =====

    private Map<String, Object> createSchoolTenant(CreateTenantRequest req) {
        String adminUsername = "admin-" + req.getCode();
        String adminPassword = securePassword(12);
        if (tenantMapper.existsCode(req.getCode())) {
            throw new ApiException(409, "conflict", "租户标识或管理员用户名已存在");
        }
        if (tenantMapper.existsLoginName(adminUsername)) {
            throw new ApiException(409, "conflict", "租户标识或管理员用户名已存在");
        }
        String tenantId = UUID.randomUUID().toString();
        tenantMapper.insertTenant(tenantId, req.getName(), req.getCode(), "school", req.getLogoUrl(), req.getDomain(),
            req.getEnterpriseCode(), req.getContact(), req.getPhone(), req.getAddress(), req.getDescription(),
            req.getValidFrom(), req.getValidUntil());
        seedSubscription(tenantId);
        seedOrgTypes(tenantId);
        seedSchoolRoles(tenantId);
        String adminId = seedAdminUser(tenantId, "school", "portal", adminUsername, adminPassword,
            req.getName() + "管理员", "school_admin");
        tenantMapper.updateAdminIds(tenantId, List.of(adminId));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("tenant", tenantMapper.selectById(tenantId));
        AdminUserInfo adminUser = new AdminUserInfo();
        adminUser.setId(adminId);
        adminUser.setUsername(adminUsername);
        adminUser.setLoginName(adminUsername);
        resp.put("adminUser", adminUser);
        return resp;
    }

    private Map<String, Object> createEnterpriseTenant(CreateTenantRequest req) {
        if (isBlank(req.getUsername())) {
            throw new ApiException(400, "bad_request", "企业管理员用户名不能为空");
        }
        validateStrongPassword(req.getPassword());
        String code = isBlank(req.getCode()) ? "ent-" + UUID.randomUUID().toString().substring(0, 8) : req.getCode();
        if (tenantMapper.existsCode(code)) {
            throw new ApiException(409, "conflict", "租户标识或管理员用户名已存在");
        }
        String tenantId = UUID.randomUUID().toString();
        tenantMapper.insertTenant(tenantId, req.getName(), code, "enterprise", req.getLogoUrl(), req.getDomain(),
            req.getEnterpriseCode(), req.getContact(), req.getPhone(), req.getAddress(), req.getDescription(),
            req.getValidFrom(), req.getValidUntil());
        seedEnterpriseRoles(tenantId);
        String adminId = seedAdminUser(tenantId, "enterprise", "partner", req.getUsername(), req.getPassword(),
            req.getName() + "管理员", "enterprise_admin");
        tenantMapper.updateAdminIds(tenantId, List.of(adminId));
        enterpriseMapper.insertEnterprise(UUID.randomUUID().toString(), tenantId, req.getName(), req.getEnterpriseCode(),
            req.getContact(), req.getPhone(), req.getContactEmail(), Boolean.TRUE);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("tenant", tenantMapper.selectById(tenantId));
        AdminUserInfo adminUser = new AdminUserInfo();
        adminUser.setId(adminId);
        adminUser.setUsername(req.getUsername());
        adminUser.setLoginName(req.getUsername());
        adminUser.setInitialPassword(req.getPassword());
        resp.put("adminUser", adminUser);
        return resp;
    }

    private void seedSubscription(String tenantId) {
        Map<String, Object> modules = new LinkedHashMap<>();
        modules.put("system", true);
        modules.put("career", true);
        modules.put("course", true);
        modules.put("scene", true);
        modules.put("ability", true);
        modules.put("resource", true);
        modules.put("alliance", true);
        modules.put("affairs", true);
        modules.put("ai", true);
        modules.put("opc", true);
        modules.put("decision", true);
        modules.put("research", true);
        subscriptionMapper.insertSubscription(UUID.randomUUID().toString(), tenantId, "默认全功能套餐", null, modules,
            "active", 0L);
    }

    private void seedOrgTypes(String tenantId) {
        String[][] types = {
            {"学校", "internal", "学校根节点"},
            {"二级学院", "internal", "二级学院/系"},
            {"专业", "internal", "专业节点"},
            {"班级", "internal", "班级节点"},
            {"行政职能部门", "internal", "行政职能部门"}
        };
        for (String[] t : types) {
            orgTypeMapper.insertOrgType(UUID.randomUUID().toString(), tenantId, t[0], t[1], t[2]);
        }
    }

    private void seedSchoolRoles(String tenantId) {
        String[][] roles = {
            {"school_admin", "学校管理员"},
            {"teacher", "教师"},
            {"student", "学生"},
            {"enterprise_mentor", "企业导师"}
        };
        for (String[] r : roles) {
            roleMapper.insertRole(UUID.randomUUID().toString(), tenantId, r[0], r[1], "", new LinkedHashMap<>());
        }
    }

    private void seedEnterpriseRoles(String tenantId) {
        roleMapper.insertRole(UUID.randomUUID().toString(), tenantId, "enterprise_admin", "企业管理员", "",
            new LinkedHashMap<>());
        roleMapper.insertRole(UUID.randomUUID().toString(), tenantId, "enterprise_member", "企业成员", "",
            new LinkedHashMap<>());
    }

    private String seedAdminUser(String tenantId, String role, String platform, String username, String password,
                                 String name, String roleCode) {
        String adminId = UUID.randomUUID().toString();
        userMapper.insertUser(adminId, tenantId, null, null, null, role, platform, tenantId + "_" + username,
            username, PASSWORD_ENCODER.encode(password), name, null, null, null, null, null, null, List.of());
        int roleRows = adminMapper.insertAdminRole(UUID.randomUUID().toString(), adminId, tenantId, roleCode);
        if (roleRows == 0) {
            throw new ApiException(500, "internal_error", "租户内不存在角色: " + roleCode);
        }
        adminMapper.incrementRoleCount(tenantId, roleCode);
        return adminId;
    }

    private void requireTenant(String tenantId) {
        if (tenantMapper.selectById(tenantId) == null) {
            throw new ApiException(404, "not_found", "租户不存在");
        }
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

    private String securePassword(int length) {
        byte[] bytes = new byte[length];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(HEX[(b >> 4) & 0xf]).append(HEX[b & 0xf]);
        }
        return sb.toString();
    }

    private String emptyToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }
}
