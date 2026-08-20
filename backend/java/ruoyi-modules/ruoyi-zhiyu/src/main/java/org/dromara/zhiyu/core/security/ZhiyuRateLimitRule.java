package org.dromara.zhiyu.core.security;

import org.springframework.util.AntPathMatcher;

import java.time.Duration;
import java.util.List;

/**
 * zhiyu /api/v1 限流规则表（对齐 Go internal/router/routes.go 的 limiter 挂载与
 * internal/cache/middleware.go 的 RateLimit/RateLimitByUser 语义）。
 *
 * <p>规则要点：</p>
 * <ul>
 *   <li>namespace 区分限流场景，各场景独立计数桶，互不误伤（Go 注释明确要求）；</li>
 *   <li>byUser=true 时按登录用户限流（未登录退回 IP 维度），用于上传/导入导出/AI/密码写；</li>
 *   <li>公开端点（登录/验证码/主题色/联盟公开前台）按 IP 限流。</li>
 * </ul>
 *
 * @author zhiyu
 */
public final class ZhiyuRateLimitRule {

    private static final AntPathMatcher MATCHER = new AntPathMatcher();
    private static final Duration ONE_MINUTE = Duration.ofMinutes(1);

    private ZhiyuRateLimitRule() {
    }

    /**
     * 单条限流规则。
     *
     * @param method      HTTP 方法（null 表示不限方法）
     * @param pathPattern Ant 风格路径模式（基于 /api/v1 完整路径）
     * @param namespace   限流场景命名空间（独立计数桶）
     * @param limit       窗口内允许次数
     * @param window      限流窗口
     * @param byUser      true=按用户限流（未登录退回 IP）；false=按 IP
     */
    public record Rule(String method, String pathPattern, String namespace, int limit, Duration window,
                       boolean byUser) {

        boolean matches(String method, String path) {
            return (this.method == null || this.method.equalsIgnoreCase(method))
                && MATCHER.match(this.pathPattern, path);
        }
    }

    /**
     * 规则按声明顺序匹配，先命中先生效（精确路径在前，宽泛前缀在后）。
     * 阈值/窗口/维度与 Go routes.go:39-73 逐项对齐。
     */
    private static final List<Rule> RULES = List.of(
        // ===== 公开端点（按 IP） =====
        // 登录/注册/选租户：login 30 次/分（Go loginLimiter）
        new Rule("POST", "/api/v1/auth/login", "login", 30, ONE_MINUTE, false),
        new Rule("POST", "/api/v1/auth/saas/login", "login", 30, ONE_MINUTE, false),
        new Rule("POST", "/api/v1/auth/portal/login", "login", 30, ONE_MINUTE, false),
        new Rule("POST", "/api/v1/auth/partner/login", "login", 30, ONE_MINUTE, false),
        new Rule("POST", "/api/v1/auth/partner/register", "login", 30, ONE_MINUTE, false),
        new Rule("POST", "/api/v1/auth/select-tenant", "login", 30, ONE_MINUTE, false),
        // 验证码生成有图片合成开销：captcha 10 次/分（Go captchaLimiter）
        new Rule("GET", "/api/v1/auth/captcha", "captcha", 10, ONE_MINUTE, false),
        // 公开主题色：theme 120 次/分（Go themeLimiter）
        new Rule("GET", "/api/v1/settings/theme", "theme", 120, ONE_MINUTE, false),
        // 联盟公开前台：public-read 120 次/分（Go publicReadLimiter）
        new Rule(null, "/api/v1/alliance/public/**", "public-read", 120, ONE_MINUTE, false),

        // ===== 登录用户端点（按用户，未登录退回 IP） =====
        // 文件上传：upload 20 次/分（Go uploadLimiter，含知识库文档上传）
        new Rule("POST", "/api/v1/files/upload", "upload", 20, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/ai/kb/*/documents", "upload", 20, ONE_MINUTE, true),
        // AI 对话/生成：ai 20 次/分（Go aiLimiter）
        new Rule("POST", "/api/v1/ai/chat", "ai", 20, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/ai/position-assist", "ai", 20, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/ai/scenario-assist", "ai", 20, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/ai/kb/*/ask", "ai", 20, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/ai/agents/*/chat", "ai", 20, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/ai/agents/*/preview", "ai", 20, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/ai/yiknow/chat", "ai", 20, ONE_MINUTE, true),
        // 导入/导出/模板：import-export 10 次/分（Go importExportLimiter）
        new Rule(null, "/api/v1/import/**", "import-export", 10, ONE_MINUTE, true),
        new Rule(null, "/api/v1/export/**", "import-export", 10, ONE_MINUTE, true),
        new Rule(null, "/api/v1/templates/**", "import-export", 10, ONE_MINUTE, true),
        // 密码写操作（改密/重置）：password 10 次/分（Go passwordLimiter）
        new Rule("POST", "/api/v1/portal/workspace/me/password", "password", 10, ONE_MINUTE, true),
        new Rule("PUT", "/api/v1/partner/me/password", "password", 10, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/admins/*/reset-password", "password", 10, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/users/*/reset-password", "password", 10, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/admin/tenants/*/admins/*/reset-password", "password", 10, ONE_MINUTE, true),
        new Rule("POST", "/api/v1/admin/tenants/*/enterprise-admins/*/reset-password", "password", 10, ONE_MINUTE, true)
    );

    /**
     * 匹配限流规则；无命中返回 null（不限流）。
     *
     * @param method HTTP 方法
     * @param path   请求路径（含 /api/v1 前缀）
     * @return 命中的规则或 null
     */
    public static Rule match(String method, String path) {
        if (method == null || path == null) {
            return null;
        }
        for (Rule rule : RULES) {
            if (rule.matches(method, path)) {
                return rule;
            }
        }
        return null;
    }
}
