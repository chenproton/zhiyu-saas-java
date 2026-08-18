package org.dromara.zhiyu.core.security;

/**
 * zhiyu 请求租户/用户上下文（对齐 Go 版 middleware 从 JWT claims 携带的信息）。
 *
 * <p>由 {@link ZhiyuAuthFilter} 在请求进入时写入、请求结束时清理；业务代码通过
 * 静态方法读取当前用户与租户（等价 Go 版 claims.UserID / claims.TenantID）。</p>
 *
 * @author zhiyu
 */
public final class TenantContext {

    private static final ThreadLocal<String> USER_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> USERNAME = new ThreadLocal<>();
    private static final ThreadLocal<String> PLATFORM = new ThreadLocal<>();

    private TenantContext() {
    }

    /**
     * 设置当前请求上下文。
     */
    public static void set(String userId, String tenantId, String username, String platform) {
        USER_ID.set(userId);
        TENANT_ID.set(tenantId);
        USERNAME.set(username);
        PLATFORM.set(platform);
    }

    /**
     * 清理当前请求上下文（Filter finally 调用）。
     */
    public static void clear() {
        USER_ID.remove();
        TENANT_ID.remove();
        USERNAME.remove();
        PLATFORM.remove();
    }

    /** 当前用户 ID（未登录为 null） */
    public static String getUserId() {
        return USER_ID.get();
    }

    /** 当前租户 ID（未登录或平台级用户为 null） */
    public static String getTenantId() {
        return TENANT_ID.get();
    }

    /** 当前用户名 */
    public static String getUsername() {
        return USERNAME.get();
    }

    /** 当前平台（saas/portal/partner） */
    public static String getPlatform() {
        return PLATFORM.get();
    }
}
