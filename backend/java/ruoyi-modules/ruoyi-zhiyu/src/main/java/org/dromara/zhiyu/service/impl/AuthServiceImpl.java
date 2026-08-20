package org.dromara.zhiyu.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.captcha.CaptchaUtil;
import cn.hutool.captcha.LineCaptcha;
import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.util.StrUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.ServletUtils;
import org.dromara.common.redis.utils.RedisUtils;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.core.web.IpLocationUtils;
import org.dromara.zhiyu.domain.system.SystemLoginLog;
import org.dromara.zhiyu.domain.ZhiyuTenant;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.AuthDtos.CaptchaData;
import org.dromara.zhiyu.domain.dto.AuthDtos.LoginRequest;
import org.dromara.zhiyu.domain.dto.AuthDtos.LoginResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.MeResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.RoleView;
import org.dromara.zhiyu.domain.dto.AuthDtos.PartnerMeResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.PartnerRegisterRequest;
import org.dromara.zhiyu.domain.dto.AuthDtos.SelectTenantRequest;
import org.dromara.zhiyu.domain.dto.AuthDtos.TenantOption;
import org.dromara.zhiyu.domain.dto.AuthDtos.ZhiyuTenantView;
import org.dromara.zhiyu.domain.dto.AuthDtos.ZhiyuUserView;
import org.dromara.zhiyu.domain.partner.PartnerEnterprise;
import org.dromara.zhiyu.mapper.ZhiyuTenantMapper;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.partner.PartnerEnterpriseMapper;
import org.dromara.zhiyu.service.IAuthService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Map;
import java.util.List;
import java.util.UUID;

/**
 * zhiyu 认证服务实现（对齐 Go auth_handler.go + middleware/auth.go 语义）。
 *
 * <p>关键对齐点：</p>
 * <ul>
 *   <li>登录候选：同 username+platform 可命中多条（每租户一条），单候选直接签发，
 *       多候选返回预授权令牌（1 分钟有效、一次性消费，等价 Go preAuth JWT + JTI 防重放）；</li>
 *   <li>门禁：用户 active、租户 active、租户有效期（valid_from/valid_until）、bcrypt 密码；</li>
 *   <li>Token 由 Sa-Token 签发（并发登录各自 token，7 天有效期），敏感字段不回传。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class AuthServiceImpl implements IAuthService {

    private static final String PRE_AUTH_KEY = "zhiyu:preauth:";
    private static final String CAPTCHA_KEY = "zhiyu:captcha:answer:";
    private static final Duration CAPTCHA_TTL = Duration.ofMinutes(5);

    /** 防爆破阈值（对齐 Go service.CaptchaFailThreshold）：同一 IP / 账号×设备失败达该次数后必须验证码 */
    private static final long CAPTCHA_FAIL_THRESHOLD = 3;
    /** IP 失败计数 key 前缀：zhiyu:captcha:fail:ip:{ip} */
    private static final String CAPTCHA_FAIL_IP_KEY = "zhiyu:captcha:fail:ip:";
    /** 账号×设备失败计数 key 前缀：zhiyu:captcha:fail:dev:{platform}:{username}:{deviceId} */
    private static final String CAPTCHA_FAIL_DEV_KEY = "zhiyu:captcha:fail:dev:";
    /** 设备信任标记 key 前缀：zhiyu:captcha:trusted:dev:{platform}:{username}:{deviceId} */
    private static final String CAPTCHA_TRUSTED_DEV_KEY = "zhiyu:captcha:trusted:dev:";
    /** 失败计数 TTL（窗口），失败次数在此窗口内累计 */
    private static final Duration CAPTCHA_FAIL_TTL = Duration.ofHours(24);
    /** 设备信任标记 TTL（滑窗），常用设备免验证码，过期后重新视为新设备 */
    private static final Duration CAPTCHA_TRUST_TTL = Duration.ofDays(90);

    private final ZhiyuUserMapper userMapper;
    private final ZhiyuTenantMapper tenantMapper;
    private final org.dromara.zhiyu.mapper.system.SystemRoleMapper systemRoleMapper;
    private final PartnerEnterpriseMapper partnerEnterpriseMapper;
    private final org.dromara.zhiyu.service.system.ISystemLogService systemLogService;
    private final org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /** 登录候选（用户 + 租户） */
    private record Candidate(ZhiyuUser user, ZhiyuTenant tenant) {
    }

    @Override
    public LoginResponse login(LoginRequest req, String platform, String clientIp) {
        // 防爆破/新设备验证码策略（对齐 Go loginWithPlatform 验证码段）：
        //   1. 无 deviceId（纯接口客户端）→ 每次登录都必须通过验证码；
        //   2. 新设备（该账号×设备无信任标记）→ 必须通过验证码；
        //   3. 常用设备连续失败达到阈值 → 必须通过验证码；
        //   4. 同一 IP 登录失败达到阈值 → 必须通过验证码（纵深防御）。
        // 校验失败直接返回，不泄露账号是否存在。
        String deviceId = StrUtil.trim(req.getDeviceId());
        boolean needCaptcha = StrUtil.isBlank(deviceId);
        if (!needCaptcha) {
            needCaptcha = !isTrustedDevice(platform, req.getUsername(), deviceId);
            if (!needCaptcha && failCountForDevice(platform, req.getUsername(), deviceId) >= CAPTCHA_FAIL_THRESHOLD) {
                needCaptcha = true;
            }
        }
        if (!needCaptcha && failCount(clientIp) >= CAPTCHA_FAIL_THRESHOLD) {
            needCaptcha = true;
        }
        if (needCaptcha) {
            verifyCaptcha(req);
        }

        List<Candidate> candidates = matchCandidates(req.getUsername(), req.getPassword(), platform);
        if (candidates.isEmpty()) {
            // 凭证错误：计入该 IP 与账号×设备失败次数（达到阈值后要求验证码）
            recordFailure(clientIp);
            if (StrUtil.isNotBlank(deviceId)) {
                recordFailureForDevice(platform, req.getUsername(), deviceId);
            }
            throw new ApiException(401, "unauthorized", "用户名或密码错误");
        }
        // 认证成功：清零 IP 失败计数、标记设备为常用并清零设备失败计数
        resetFailure(clientIp);
        if (StrUtil.isNotBlank(deviceId)) {
            markTrustedDevice(platform, req.getUsername(), deviceId);
            resetFailureForDevice(platform, req.getUsername(), deviceId);
        }
        if (candidates.size() == 1) {
            return issueToken(candidates.getFirst().user());
        }
        // 多租户候选：签发预授权令牌，由前端选择租户后调用 selectTenant
        List<TenantOption> options = candidates.stream().map(c -> {
            TenantOption o = new TenantOption();
            o.setTenantId(c.tenant().getId());
            o.setTenantName(c.tenant().getName());
            o.setUserId(c.user().getId());
            return o;
        }).toList();

        String preAuthToken = RandomUtil.randomString(32);
        PreAuthPayload payload = new PreAuthPayload(req.getUsername(), platform, options);
        // 1 分钟有效，消费后删除（等价 Go preAuth JWT 1 分钟 + JTI 防重放）；
        // 用 StringRedisTemplate 存 JSON 字符串（避开框架 Fory 序列化 record 的不稳定）
        stringRedisTemplate.opsForValue().set(PRE_AUTH_KEY + preAuthToken,
            org.dromara.common.json.utils.JsonUtils.toJsonString(payload), java.time.Duration.ofMinutes(1));

        LoginResponse resp = new LoginResponse();
        resp.setNeedsTenantSelection(true);
        resp.setPreAuthToken(preAuthToken);
        resp.setTenants(options);
        return resp;
    }

    @Override
    public LoginResponse selectTenant(SelectTenantRequest req) {
        String key = PRE_AUTH_KEY + req.getPreAuthToken();
        // 预授权载荷以 JSON 字符串存 Redis（StringRedisTemplate，无对象序列化问题）
        String json = stringRedisTemplate.opsForValue().get(key);
        if (json == null) {
            throw new ApiException(401, "unauthorized", "预授权令牌无效或已过期");
        }
        PreAuthPayload payload = org.dromara.common.json.utils.JsonUtils.parseObject(json, PreAuthPayload.class);
        // 一次性消费（等价 Go JTI 防重放：同一预授权令牌只能签发一次）
        stringRedisTemplate.delete(key);

        String targetUserId = null;
        for (TenantOption opt : payload.options()) {
            if (opt.getTenantId().equals(req.getTenantId())) {
                targetUserId = opt.getUserId();
                break;
            }
        }
        if (targetUserId == null) {
            throw new ApiException(400, "bad_request", "无效租户选择");
        }

        ZhiyuUser user = userMapper.selectById(targetUserId);
        if (user == null) {
            throw new ApiException(401, "unauthorized", "账号已停用");
        }
        if (user.getStatus() != null && !"active".equals(user.getStatus())) {
            throw new ApiException(401, "unauthorized", "账号已停用");
        }
        // 复核选中租户状态与有效期（对齐 Go：防止预授权窗口内租户被停用/过期）
        ZhiyuTenant tenant = tenantMapper.selectById(req.getTenantId());
        if (tenant == null) {
            throw new ApiException(401, "unauthorized", "租户不存在");
        }
        if (tenant.getStatus() != null && !"active".equals(tenant.getStatus())) {
            throw new ApiException(401, "unauthorized", "租户已停用");
        }
        if (!isTenantWithinValidity(tenant)) {
            throw new ApiException(403, "forbidden", "租户不在有效期内，请联系管理员");
        }
        return issueToken(user);
    }

    @Override
    public MeResponse me(String userId) {
        ZhiyuUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new ApiException(401, "unauthorized", "未登录或登录已过期");
        }
        MeResponse resp = new MeResponse();
        resp.setUser(toUserView(user));
        if (user.getTenantId() != null && !user.getTenantId().isBlank()) {
            ZhiyuTenant tenant = tenantMapper.selectById(user.getTenantId());
            if (tenant != null) {
                resp.setTenant(toTenantView(tenant));
            }
        }
        // 角色对象数组（对齐 Go fetchUserRoles：前端按 activeRole.permissions.menus 判菜单权限）
        List<RoleView> roleViews = new ArrayList<>();
        List<String> roleIds = new ArrayList<>();
        List<String> roleCodes = new ArrayList<>();
        List<String> roleNames = new ArrayList<>();
        for (Map<String, Object> row : systemRoleMapper.selectFullRolesByUser(userId)) {
            RoleView rv = new RoleView();
            rv.setId(str(row.get("id")));
            rv.setTenantId(str(row.get("tenant_id")));
            rv.setCode(str(row.get("code")));
            rv.setName(str(row.get("name")));
            rv.setDescription(str(row.get("description")));
            rv.setUserCount(row.get("user_count") == null ? null : ((Number) row.get("user_count")).intValue());
            rv.setStatus(str(row.get("status")));
            Object cat = row.get("created_at");
            if (cat instanceof java.time.OffsetDateTime odt) {
                rv.setCreatedAt(odt);
            } else if (cat instanceof java.time.LocalDateTime ldt) {
                rv.setCreatedAt(ldt.atOffset(java.time.ZoneOffset.ofHours(8)));
            } else if (cat instanceof java.sql.Timestamp ts) {
                rv.setCreatedAt(ts.toInstant().atOffset(java.time.ZoneOffset.ofHours(8)));
            }
            Object perms = row.get("permissions");
            if (perms instanceof String ps && !ps.isBlank()) {
                try {
                    rv.setPermissions(org.dromara.common.json.utils.JsonUtils.parseObject(ps, Map.class));
                } catch (Exception ignored) {
                    rv.setPermissions(Map.of());
                }
            }
            if (rv.getId() != null) {
                roleIds.add(rv.getId());
            }
            if (rv.getCode() != null) {
                roleCodes.add(rv.getCode());
            }
            if (rv.getName() != null) {
                roleNames.add(rv.getName());
            }
            roleViews.add(rv);
        }
        resp.setRoles(roleViews);
        // 对齐 Go User JSON：user 对象携带 roleIds/roleCodes/roleNames
        ZhiyuUserView uv = resp.getUser();
        if (uv != null) {
            uv.setRoleIds(roleIds);
            uv.setRoleCodes(roleCodes);
            uv.setRoleNames(roleNames);
        }
        return resp;
    }

    private String str(Object o) {
        return o == null ? null : o.toString();
    }

    @Override
    public CaptchaData captcha() {
        // 字符验证码（Hutool LineCaptcha 本地渲染），答案只存服务端（Redis，一次性消费）
        LineCaptcha captcha = CaptchaUtil.createLineCaptcha(160, 60, 4, 20);
        captcha.createCode();
        String captchaId = UUID.randomUUID().toString();
        String answer = captcha.getCode().toLowerCase();
        stringRedisTemplate.opsForValue().set(CAPTCHA_KEY + captchaId, answer, CAPTCHA_TTL);

        CaptchaData data = new CaptchaData();
        data.setCaptchaId(captchaId);
        data.setImage(captcha.getImageBase64Data());
        return data;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LoginResponse partnerRegister(PartnerRegisterRequest req) {
        if (req.getEnterpriseName() == null || req.getEnterpriseName().isBlank()
            || req.getUsername() == null || req.getUsername().isBlank()) {
            throw new ApiException(400, "bad_request", "企业名称和用户名不能为空");
        }
        validatePassword(req.getPassword());

        // 企业租户（type=enterprise）
        ZhiyuTenant tenant = new ZhiyuTenant();
        tenant.setName(req.getEnterpriseName());
        tenant.setCode("ent-" + UUID.randomUUID().toString().substring(0, 8));
        tenant.setType("enterprise");
        tenant.setStatus("active");
        tenant.setContact(req.getContactPerson());
        tenant.setPhone(req.getContactPhone());
        tenantMapper.insert(tenant);

        // 企业主体（partner_enterprises，默认开启「愿意对外展示」）
        PartnerEnterprise enterprise = new PartnerEnterprise();
        enterprise.setTenantId(tenant.getId());
        enterprise.setName(req.getEnterpriseName());
        enterprise.setContactPerson(req.getContactPerson());
        enterprise.setContactPhone(req.getContactPhone());
        enterprise.setContactEmail(req.getContactEmail());
        enterprise.setUnifiedSocialCreditCode(req.getUnifiedSocialCreditCode());
        enterprise.setEnablePublic(true);
        enterprise.setCooperationTypes(new ArrayList<>());
        enterprise.setBusinessLicensePhotos(new ArrayList<>());
        enterprise.setQualificationPhotos(new ArrayList<>());
        enterprise.setIntellectualPropertyPhotos(new ArrayList<>());
        enterprise.setCoverPhotos(new ArrayList<>());
        try {
            partnerEnterpriseMapper.insertEnterprise(enterprise);
        } catch (Exception e) {
            throw new ApiException(409, "conflict", "企业名称已被注册");
        }

        // 企业管理员账号（platform=partner，role=enterprise）
        String contactName = req.getContactName() == null || req.getContactName().isBlank()
            ? req.getEnterpriseName() + "管理员" : req.getContactName();
        ZhiyuUser user = new ZhiyuUser();
        user.setTenantId(tenant.getId());
        user.setRole("enterprise");
        user.setPlatform("partner");
        user.setUsername(req.getUsername());
        user.setLoginName(req.getUsername());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setName(contactName);
        user.setStatus("active");
        user.setPasswordChangedAt(OffsetDateTime.now());
        userMapper.insert(user);

        return issueToken(user);
    }

    @Override
    public PartnerMeResponse partnerMe(String userId) {
        if (!"partner".equals(org.dromara.zhiyu.core.security.TenantContext.getPlatform())) {
            throw new ApiException(403, "forbidden", "无效平台");
        }
        ZhiyuUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new ApiException(401, "unauthorized", "未登录或登录已过期");
        }

        PartnerMeResponse resp = new PartnerMeResponse();
        resp.setUser(toUserView(user));
        if (user.getTenantId() != null && !user.getTenantId().isBlank()) {
            List<PartnerEnterprise> enterprises = partnerEnterpriseMapper.selectList(
                org.dromara.common.mybatis.core.query.QueryBuilder.lambda(PartnerEnterprise.class)
                    .eq(PartnerEnterprise::getTenantId, user.getTenantId())
                    .build());
            if (!enterprises.isEmpty()) {
                resp.setEnterprise(enterprises.get(0));
            }
        }
        resp.setRoles(systemRoleMapper.selectRolesByUser(user.getId()));
        return resp;
    }

    /**
     * 校验登录验证码（必填语义）：按现有答案 key（zhiyu:captcha:answer:{captchaId}）
     * 校验并一次性消费。答案不存在/已过期 → captcha_required；字符不匹配 → captcha_wrong。
     */
    private void verifyCaptcha(LoginRequest req) {
        String key = CAPTCHA_KEY + req.getCaptchaId();
        String answer;
        try {
            answer = stringRedisTemplate.opsForValue().get(key);
        } catch (Exception e) {
            // Redis 不可用：无法校验答案，按「未完成验证码」返回 400（而非 500 阻断）
            throw new ApiException(400, "captcha_required", "请完成验证码");
        }
        if (answer == null) {
            throw new ApiException(400, "captcha_required", "请完成验证码");
        }
        // 一次性：无论对错均删除，防重放
        try {
            stringRedisTemplate.delete(key);
        } catch (Exception ignored) {
            // 删除失败不阻断（答案已读取，容忍一次重放窗口）
        }
        if (!answer.equalsIgnoreCase(StrUtil.trim(req.getCaptchaCode()))) {
            throw new ApiException(400, "captcha_wrong", "验证码不正确，请重试");
        }
    }

    /** 该 IP 当前登录失败次数（TTL 窗口内，Redis 不可用降级为 0，不阻断登录） */
    private long failCount(String ip) {
        try {
            String v = stringRedisTemplate.opsForValue().get(CAPTCHA_FAIL_IP_KEY + ip);
            return v == null ? 0 : Long.parseLong(v);
        } catch (Exception e) {
            return 0;
        }
    }

    /** 记录一次 IP 登录失败（首次失败时设置窗口 TTL；Redis 不可用静默跳过） */
    private void recordFailure(String ip) {
        try {
            String key = CAPTCHA_FAIL_IP_KEY + ip;
            Long n = stringRedisTemplate.opsForValue().increment(key);
            if (n != null && n == 1L) {
                stringRedisTemplate.expire(key, CAPTCHA_FAIL_TTL);
            }
        } catch (Exception ignored) {
            // Redis 不可用：静默跳过，不阻断登录
        }
    }

    /** 登录成功后清零 IP 失败计数 */
    private void resetFailure(String ip) {
        try {
            stringRedisTemplate.delete(CAPTCHA_FAIL_IP_KEY + ip);
        } catch (Exception ignored) {
        }
    }

    /** 该账号×设备是否为常用设备（90 天内有成功登录；Redis 不可用降级为「视为常用」，不阻断登录） */
    private boolean isTrustedDevice(String platform, String username, String deviceId) {
        try {
            return Boolean.TRUE.equals(stringRedisTemplate.hasKey(trustedDeviceKey(platform, username, deviceId)));
        } catch (Exception e) {
            return true;
        }
    }

    /** 登录成功后标记设备为常用设备（滑窗刷新有效期；Redis 不可用静默跳过） */
    private void markTrustedDevice(String platform, String username, String deviceId) {
        try {
            stringRedisTemplate.opsForValue().set(trustedDeviceKey(platform, username, deviceId), "1", CAPTCHA_TRUST_TTL);
        } catch (Exception ignored) {
        }
    }

    /** 该账号×设备当前登录失败次数（TTL 窗口内，Redis 不可用降级为 0） */
    private long failCountForDevice(String platform, String username, String deviceId) {
        try {
            String v = stringRedisTemplate.opsForValue().get(deviceFailKey(platform, username, deviceId));
            return v == null ? 0 : Long.parseLong(v);
        } catch (Exception e) {
            return 0;
        }
    }

    /** 记录一次账号×设备登录失败（首次失败时设置窗口 TTL；Redis 不可用静默跳过） */
    private void recordFailureForDevice(String platform, String username, String deviceId) {
        try {
            String key = deviceFailKey(platform, username, deviceId);
            Long n = stringRedisTemplate.opsForValue().increment(key);
            if (n != null && n == 1L) {
                stringRedisTemplate.expire(key, CAPTCHA_FAIL_TTL);
            }
        } catch (Exception ignored) {
        }
    }

    /** 登录成功后清零账号×设备失败计数 */
    private void resetFailureForDevice(String platform, String username, String deviceId) {
        try {
            stringRedisTemplate.delete(deviceFailKey(platform, username, deviceId));
        } catch (Exception ignored) {
        }
    }

    /** 账号×设备失败计数 key（username 小写规范化，与 Go 大小写无关语义保持一致） */
    private String deviceFailKey(String platform, String username, String deviceId) {
        return CAPTCHA_FAIL_DEV_KEY + platform + ":" + normalizeUsername(username) + ":" + deviceId;
    }

    /** 账号×设备信任标记 key */
    private String trustedDeviceKey(String platform, String username, String deviceId) {
        return CAPTCHA_TRUSTED_DEV_KEY + platform + ":" + normalizeUsername(username) + ":" + deviceId;
    }

    private String normalizeUsername(String username) {
        return username == null ? "" : username.toLowerCase();
    }

    /** 密码强度校验（对齐 Go validatePassword：≥8 位且含字母与数字） */
    private void validatePassword(String password) {
        if (password == null || password.length() < 8) {
            throw new ApiException(400, "bad_request", "密码长度至少 8 位，且需同时包含字母和数字");
        }
        boolean hasLetter = false;
        boolean hasDigit = false;
        for (char c : password.toCharArray()) {
            if (Character.isLetter(c)) {
                hasLetter = true;
            } else if (Character.isDigit(c)) {
                hasDigit = true;
            }
        }
        if (!hasLetter || !hasDigit) {
            throw new ApiException(400, "bad_request", "密码长度至少 8 位，且需同时包含字母和数字");
        }
    }

    /**
     * 按 username+platform 查询登录候选，依次过滤用户/租户状态、密码与租户有效期。
     */
    private List<Candidate> matchCandidates(String username, String password, String platform) {
        List<ZhiyuUser> users = userMapper.selectList(
            org.dromara.common.mybatis.core.query.QueryBuilder.lambda(ZhiyuUser.class)
                .eq(ZhiyuUser::getUsername, username)
                .eq(ZhiyuUser::getPlatform, platform)
                .build());

        List<Candidate> candidates = new ArrayList<>();
        for (ZhiyuUser user : users) {
            if (user.getStatus() != null && !"active".equals(user.getStatus())) {
                continue;
            }
            ZhiyuTenant tenant = null;
            if (user.getTenantId() != null && !user.getTenantId().isBlank()) {
                tenant = tenantMapper.selectById(user.getTenantId());
            }
            if (tenant != null) {
                if (tenant.getStatus() != null && !"active".equals(tenant.getStatus())) {
                    continue;
                }
                if (!isTenantWithinValidity(tenant)) {
                    continue;
                }
            }
            if (user.getPasswordHash() != null
                && passwordEncoder.matches(password, user.getPasswordHash())) {
                candidates.add(new Candidate(user, tenant));
            }
        }
        return candidates;
    }

    /**
     * 签发正式 token：Sa-Token 登录并写入会话上下文（对齐 Go GenerateToken 的 claims）。
     *
     * <p>前端通过解析 JWT payload 读取 roleCodes/username 等字段做权限守卫
     * （如 superadmin 页判断 platform_admin），故将 Go 版 Claims 字段注入 token extra。</p>
     */
    private LoginResponse issueToken(ZhiyuUser user) {
        List<String> roleCodes = systemRoleMapper.selectRoleCodesByUser(user.getId());
        StpUtil.login(user.getId(), new cn.dev33.satoken.stp.SaLoginModel()
            .setExtra("roleCodes", roleCodes)
            .setExtra("username", user.getUsername())
            .setExtra("tenantId", user.getTenantId())
            .setExtra("institutionId", user.getInstitutionId())
            .setExtra("orgNodeId", user.getOrgNodeId())
            .setExtra("role", user.getRole())
            .setExtra("platform", user.getPlatform()));
        StpUtil.getSession().set("userId", user.getId());
        StpUtil.getSession().set("tenantId", user.getTenantId());
        StpUtil.getSession().set("username", user.getUsername());
        StpUtil.getSession().set("platform", user.getPlatform());
        // 角色编码快照（等价 Go claims.RoleCodes），服务端授权判定（菜单兜底/角色白名单）用
        StpUtil.getSession().set("roleCodes", roleCodes);

        // 登录日志（对齐 Go auth_handler.go recordLoginLog：login/select-tenant/register 统一入口）
        recordLoginLog(user);

        LoginResponse resp = new LoginResponse();
        resp.setToken(StpUtil.getTokenValue());
        resp.setUser(toUserView(user));
        return resp;
    }

    /**
     * 记录登录日志（对齐 Go service/auth.go RecordLoginLog + handler/auth_handler.go recordLoginLog）。
     *
     * <p>字段语义：无租户（平台级账号）不记录；user_name 取姓名、空则登录名；
     * device 为 User-Agent 截断 256；location 为 ip2region 归属地（"省 市"，内网/失败为空）；
     * status 仅记录 success（Go 端只在签发 token 时记录）。写入失败只告警不影响登录。</p>
     */
    private void recordLoginLog(ZhiyuUser user) {
        try {
            if (user.getTenantId() == null || user.getTenantId().isBlank()) {
                return;
            }
            HttpServletRequest request = ServletUtils.getRequest();
            String ip = request == null ? "" : StrUtil.blankToDefault(ServletUtils.getClientIP(request), "");
            String device = request == null ? "" : StrUtil.blankToDefault(request.getHeader("User-Agent"), "");
            if (device.length() > 256) {
                device = device.substring(0, 256);
            }
            SystemLoginLog entry = new SystemLoginLog();
            entry.setTenantId(user.getTenantId());
            entry.setUserId(user.getId());
            entry.setUserName(StrUtil.isBlank(user.getName()) ? user.getUsername() : user.getName());
            entry.setIp(ip);
            entry.setLocation(IpLocationUtils.location(ip));
            entry.setDevice(device);
            entry.setStatus("success");
            systemLogService.recordLoginLog(entry);
        } catch (Exception e) {
            log.warn("zhiyu 登录日志记录失败 userId={} 原因={}", user.getId(), e.getMessage());
        }
    }

    /** 租户有效期判定（对齐 Go isTenantWithinValidity：YYYY-MM-DD，空不限） */
    private boolean isTenantWithinValidity(ZhiyuTenant tenant) {
        String today = LocalDate.now().toString();
        if (tenant.getValidFrom() != null && !tenant.getValidFrom().isBlank()
            && tenant.getValidFrom().compareTo(today) > 0) {
            return false;
        }
        if (tenant.getValidUntil() != null && !tenant.getValidUntil().isBlank()
            && tenant.getValidUntil().compareTo(today) < 0) {
            return false;
        }
        return true;
    }

    private ZhiyuUserView toUserView(ZhiyuUser u) {
        ZhiyuUserView v = new ZhiyuUserView();
        v.setId(u.getId());
        v.setTenantId(u.getTenantId());
        v.setInstitutionId(u.getInstitutionId());
        v.setOrgNodeId(u.getOrgNodeId());
        v.setMajorId(u.getMajorId());
        v.setRole(u.getRole());
        v.setPlatform(u.getPlatform());
        v.setLoginName(u.getLoginName());
        v.setUsername(u.getUsername());
        v.setName(u.getName());
        v.setEmail(u.getEmail());
        v.setPhone(u.getPhone());
        v.setAvatarUrl(u.getAvatarUrl());
        v.setStudentNo(u.getStudentNo());
        v.setWorkId(u.getWorkId());
        v.setIdCard(u.getIdCard());
        v.setStatus(u.getStatus());
        v.setLastLoginAt(u.getLastLoginAt());
        v.setCreatedAt(u.getCreatedAt());
        v.setUpdatedAt(u.getUpdatedAt());
        v.setGraduateYear(u.getGraduateYear());
        return v;
    }

    private ZhiyuTenantView toTenantView(ZhiyuTenant t) {
        ZhiyuTenantView v = new ZhiyuTenantView();
        v.setId(t.getId());
        v.setName(t.getName());
        v.setCode(t.getCode());
        v.setLogoUrl(t.getLogoUrl());
        v.setDomain(t.getDomain());
        v.setEnterpriseCode(t.getEnterpriseCode());
        v.setContact(t.getContact());
        v.setPhone(t.getPhone());
        v.setAddress(t.getAddress());
        v.setDescription(t.getDescription());
        v.setStatus(t.getStatus());
        v.setCreatedAt(t.getCreatedAt());
        v.setUpdatedAt(t.getUpdatedAt());
        v.setShortName(t.getShortName());
        v.setSchoolType(t.getSchoolType());
        v.setProvince(t.getProvince());
        v.setCity(t.getCity());
        v.setWebsite(t.getWebsite());
        v.setContactPhone(t.getContactPhone());
        v.setValidFrom(t.getValidFrom());
        v.setValidUntil(t.getValidUntil());
        return v;
    }

    /** 预授权载荷（Redis 存储，1 分钟有效） */
    /** 预授权载荷（JSON 存 Redis，1 分钟有效；public 便于 Jackson 反序列化） */
    public record PreAuthPayload(String username, String platform, List<TenantOption> options) {
    }
}
