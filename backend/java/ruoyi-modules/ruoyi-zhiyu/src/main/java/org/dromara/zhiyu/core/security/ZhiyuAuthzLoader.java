package org.dromara.zhiyu.core.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.common.redis.utils.RedisUtils;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.mapper.system.SystemRoleMapper;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 用户服务端授权快照加载器（对齐 Go middleware/menu.go loadMenuGrant + store
 * GetUserMenuGrant，菜单驱动 RBAC 的统一数据源，见 ADR-0008）。
 *
 * <p>语义对齐要点：</p>
 * <ul>
 *   <li>菜单授权按请求查库合并用户全部角色的 permissions.menus（+ admin 标记），
 *       经 Redis 短缓存（60s）降低请求开销；角色权限变更最长 60s 后生效；</li>
 *   <li>DB 异常 fail-closed：返回空授权视图（业务判定据此 403），不阻断鉴权主链路
 *       （ZhiyuAuthFilter 已做会话校验）；</li>
 *   <li>「无 menus = 全量」兜底：school_admin/platform_admin 角色合并结果为空时视为
 *       全量放行（与前端 hasMenuPermission 短路语义一致，ADR-0008 决策 5）；</li>
 *   <li>角色编码等价 Go 令牌 claims.RoleCodes：登录时写入 Sa-Token 会话（见
 *       AuthServiceImpl#issueToken），旧会话缺失时回退查库。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ZhiyuAuthzLoader {

    private final SystemRoleMapper systemRoleMapper;

    /** 菜单授权缓存时长（对齐 Go menuGrantCacheTTL = 60s） */
    private static final Duration CACHE_TTL = Duration.ofSeconds(60);

    /**
     * 当前请求用户的授权快照（未登录返回空快照）。
     */
    public AuthzSnapshot current() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            return AuthzSnapshot.empty();
        }
        return load(userId);
    }

    /**
     * 加载指定用户的授权快照：优先 Redis 缓存，未命中查库合并并写回缓存。
     */
    public AuthzSnapshot load(String userId) {
        List<String> roleCodes = TenantContext.getRoleCodes();

        // Redis 缓存命中直接返回（缓存内容为兜底判定后的最终视图，与 Go 一致）
        MenuGrant cachedGrant = null;
        List<String> cachedRoleCodes = null;
        try {
            Map<String, Object> cached = RedisUtils.getCacheObject(cacheKey(userId));
            if (cached != null) {
                cachedGrant = grantFromCache(cached);
                cachedRoleCodes = stringsFromCache(cached.get("roleCodes"));
            }
        } catch (Exception e) {
            log.warn("读取菜单授权缓存异常，按未命中处理 userId={} 原因={}", userId, e.getMessage());
        }
        if (cachedGrant != null) {
            if (roleCodes == null) {
                roleCodes = cachedRoleCodes != null ? cachedRoleCodes : List.of();
            }
            return new AuthzSnapshot(roleCodes, cachedGrant);
        }

        // 查库合并全部角色的菜单授权（对齐 Go GetUserMenuGrant）
        MenuGrant grant = new MenuGrant();
        List<String> dbRoleCodes = new ArrayList<>();
        try {
            for (Map<String, Object> row : systemRoleMapper.selectFullRolesByUser(userId)) {
                Object code = row.get("code");
                if (code != null) {
                    dbRoleCodes.add(code.toString());
                }
                Object perms = row.get("permissions");
                if (perms instanceof String ps && !ps.isBlank()) {
                    try {
                        grant.merge(JsonUtils.parseObject(ps, Map.class));
                    } catch (Exception parseEx) {
                        log.warn("角色 permissions 解析失败，跳过该角色 userId={} 原因={}", userId, parseEx.getMessage());
                    }
                } else if (perms instanceof Map<?, ?> pm) {
                    Map<String, Object> permsMap = new HashMap<>();
                    for (Map.Entry<?, ?> entry : pm.entrySet()) {
                        if (entry.getKey() instanceof String k) {
                            permsMap.put(k, entry.getValue());
                        }
                    }
                    grant.merge(permsMap);
                }
            }
        } catch (Exception e) {
            // DB 异常 fail-closed：返回空授权视图（对齐 Go loadMenuGrant err 分支）
            log.warn("加载用户菜单授权 DB 异常 fail-closed userId={} 原因={}", userId, e.getMessage());
            grant = new MenuGrant();
        }
        if (roleCodes == null) {
            roleCodes = dbRoleCodes;
        }
        applyFullAccessFallback(grant, roleCodes);

        // 写回缓存（含 DB 异常的 fail-closed 结果，与 Go 一致）
        try {
            Map<String, Object> cacheValue = new HashMap<>();
            cacheValue.put("admin", grant.isAdmin());
            cacheValue.put("paths", new ArrayList<>(grant.getGrantedPaths()));
            cacheValue.put("roleCodes", roleCodes);
            RedisUtils.setCacheObject(cacheKey(userId), cacheValue, CACHE_TTL);
        } catch (Exception e) {
            log.warn("写菜单授权缓存异常，忽略 userId={} 原因={}", userId, e.getMessage());
        }
        return new AuthzSnapshot(roleCodes, grant);
    }

    /**
     * 「无 menus = 全量」兜底（对齐 Go applyFullAccessFallback，ADR-0008 决策 5）：
     * school_admin/platform_admin 角色合并结果为空（未显式配置菜单）时视为全量放行。
     * 静态包可见以便单测直接覆盖 Go menu_test.go TestMenuGrant_FullAccessFallback 矩阵。
     */
    static void applyFullAccessFallback(MenuGrant grant, List<String> roleCodes) {
        if (grant == null || !grant.isEmpty()) {
            return;
        }
        for (String code : roleCodes) {
            if (ZhiyuAuthzRules.ROLE_SCHOOL_ADMIN.equals(code) || ZhiyuAuthzRules.ROLE_PLATFORM_ADMIN.equals(code)) {
                grant.setAdmin(true);
                return;
            }
        }
    }

    /**
     * 联盟管理权限判定（对齐 Go handler/common.go canManageAlliance）：
     * 系统权限直接放行；否则菜单授权覆盖任一联盟管理菜单（/portal/apps/alliance 前缀）。
     * 仅勾前台落地页（/portal/alliance/landing）是前台只读角色，不获管理权限。
     */
    public boolean canManageAlliance() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            return false;
        }
        AuthzSnapshot snapshot = current();
        if (snapshot.hasSystemPermission()) {
            return true;
        }
        return snapshot.grant().coversPrefix(ZhiyuMenuCatalog.ALLIANCE_MENU_PREFIX);
    }

    /**
     * AI 管理端写前校验（对齐 Go routes_ai_center.go:61-71 RequireMenu(aiAdminMenus)）：
     * 勾选 AI 管理菜单（审核/挂接）即获得管理权限，不再限 school_admin 角色。
     */
    public void requireAiCenterAdmin() {
        if (!current().coversAny(ZhiyuMenuCatalog.AI_ADMIN_MENUS)) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
    }

    /**
     * partner 管理员写接口校验（对齐 Go routes_partner.go:95-104 adminOnly
     * RequireRole(enterprise_admin)）。
     */
    public void requireEnterpriseAdmin() {
        if (!current().hasRole(ZhiyuAuthzRules.ROLE_ENTERPRISE_ADMIN)) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
    }

    /**
     * school_admin 角色判定（对齐 Go aiIsSchoolAdmin：按令牌角色编码而非 users.role
     * 单字段），用于 AI 中心审核管理只读体验放行。
     */
    public boolean isSchoolAdmin() {
        return current().hasRole(ZhiyuAuthzRules.ROLE_SCHOOL_ADMIN);
    }

    private String cacheKey(String userId) {
        // 与 Go 的 "menu:grant:" 键区分，避免双栈共享 Redis 时缓存格式互相污染
        return "java:menu:grant:" + userId;
    }

    @SuppressWarnings("unchecked")
    private MenuGrant grantFromCache(Map<String, Object> cached) {
        MenuGrant grant = new MenuGrant();
        Object admin = cached.get("admin");
        if (admin instanceof Boolean b && b) {
            grant.setAdmin(true);
        }
        Object paths = cached.get("paths");
        if (paths instanceof Iterable<?> iterable) {
            for (Object p : iterable) {
                if (p instanceof String path) {
                    grant.getGrantedPaths().add(path);
                }
            }
        }
        return grant;
    }

    private List<String> stringsFromCache(Object value) {
        if (!(value instanceof Iterable<?> iterable)) {
            return null;
        }
        List<String> out = new ArrayList<>();
        for (Object item : iterable) {
            if (item instanceof String s) {
                out.add(s);
            }
        }
        return out;
    }
}
