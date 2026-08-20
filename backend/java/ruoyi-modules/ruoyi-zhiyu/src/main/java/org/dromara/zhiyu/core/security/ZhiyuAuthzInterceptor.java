package org.dromara.zhiyu.core.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * zhiyu 服务端授权拦截器（/api/v1/**，对齐 Go 端三层服务端授权，安全红线级语义等价）：
 *
 * <ol>
 *   <li>菜单驱动 API 授权（ADR-0008 RequireMenu）：规则表见 {@link ZhiyuAuthzRules}，
 *       菜单目录见 {@link ZhiyuMenuCatalog}，授权视图加载见 {@link ZhiyuAuthzLoader}；</li>
 *   <li>平台 token 隔离（Go RequirePlatform/RequireAnyPlatform）：portal/saas/partner
 *       三平台 token 互不通用，跨平台访问 403 {@code {"error":"platform mismatch"}}；</li>
 *   <li>角色白名单（Go RequireRole）：partner adminOnly、超管 platform_admin、
 *       服务台 RequireRoleOrMenu、用户读 RequireUserRead、系统管理
 *       RequireSystemPermission，未授权 403 {@code {"error":"permission denied"}}。</li>
 * </ol>
 *
 * <p>挂载在 {@link ZhiyuAuthFilter}（登录校验 + 活跃用户校验）之后；未登录请求已被
 * 过滤器 401 拦截，此处再兜底一次（对齐 Go 各中间件 claims==nil → 401）。</p>
 *
 * @author zhiyu
 */
@Component
@RequiredArgsConstructor
public class ZhiyuAuthzInterceptor implements HandlerInterceptor {

    private final ZhiyuAuthzLoader authzLoader;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
        throws Exception {
        String path = request.getRequestURI();
        // 公开路径（登录/预授权消费/公开主题色）与 ZhiyuAuthFilter 保持一致，直接放行
        if (ZhiyuAuthFilter.PUBLIC_PATHS.contains(path)) {
            return true;
        }

        String method = request.getMethod();
        String userId = TenantContext.getUserId();
        String platform = TenantContext.getPlatform();

        ZhiyuAuthzRules.Requirement requirement = ZhiyuAuthzRules.decide(method, path);

        // 平台隔离先行（对齐 Go RequirePlatform：跨平台 403 platform mismatch）；
        // 平台匹配且规则需要授权信息时才加载授权快照（AUTHENTICATED 规则零查库开销）
        ZhiyuAuthzRules.Outcome preOutcome;
        if (userId == null || userId.isBlank()) {
            preOutcome = ZhiyuAuthzRules.Outcome.UNAUTHORIZED;
        } else if (!requirement.platforms().contains(platform)) {
            preOutcome = ZhiyuAuthzRules.Outcome.FORBIDDEN_PLATFORM;
        } else {
            AuthzSnapshot snapshot = requirement.kind() == ZhiyuAuthzRules.Kind.AUTHENTICATED
                ? AuthzSnapshot.empty() : authzLoader.load(userId);
            preOutcome = ZhiyuAuthzRules.evaluate(requirement, method, userId, platform, snapshot);
        }

        switch (preOutcome) {
            case ALLOW -> {
                return true;
            }
            case UNAUTHORIZED -> {
                writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "unauthorized");
                return false;
            }
            case FORBIDDEN_PLATFORM -> {
                writeError(response, HttpServletResponse.SC_FORBIDDEN, "platform mismatch");
                return false;
            }
            default -> {
                writeError(response, HttpServletResponse.SC_FORBIDDEN, "permission denied");
                return false;
            }
        }
    }

    /**
     * 输出授权失败响应（状态码/文案对齐 Go 中间件 http.Error，响应体同 ZhiyuAuthFilter 风格）。
     */
    private void writeError(HttpServletResponse response, int status, String message)
        throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
