package org.dromara.zhiyu.core.security;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.StrUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.zhiyu.domain.ZhiyuTenant;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.mapper.ZhiyuTenantMapper;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * zhiyu 接口鉴权过滤器（/api/v1/**，对齐 Go middleware JWT/RequireActiveUser 语义）。
 *
 * <p>zhiyu 接口已从框架 SaInterceptor 排除（security.excludes 含 /api/v1/**），
 * 由本过滤器独立鉴权：解析 Authorization Bearer token → 校验 Sa-Token 会话 →
 * 逐请求校验用户/租户状态（停用即时失效，fail-closed）→ 写入 {@link TenantContext}；
 * 401 响应体对齐 Go 中间件文本（missing authorization header / unauthorized /
 * 账号已停用 / 租户已停用）。</p>
 *
 * @author zhiyu
 */
@Slf4j
@Order(1)
@Component
@RequiredArgsConstructor
public class ZhiyuAuthFilter extends OncePerRequestFilter {

    private final ZhiyuUserMapper userMapper;
    private final ZhiyuTenantMapper tenantMapper;

    /** 无需登录即可访问的 zhiyu 路径（登录/预授权消费/公开主题色）；授权拦截器复用同一清单 */
    static final Set<String> PUBLIC_PATHS = Set.of(
        "/api/v1/auth/login",
        "/api/v1/auth/saas/login",
        "/api/v1/auth/portal/login",
        "/api/v1/auth/partner/login",
        "/api/v1/auth/partner/register",
        "/api/v1/auth/captcha",
        // 多租户登录后的租户选择（凭预授权令牌访问，尚无正式 token，必须放行）
        "/api/v1/auth/select-tenant",
        "/api/v1/settings/theme"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // 只处理 /api/v1/** 且非公开路径
        if (!path.startsWith("/api/v1/")) {
            return true;
        }
        return PUBLIC_PATHS.contains(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {

        String token = extractToken(request);
        if (StrUtil.isBlank(token)) {
            log.warn("zhiyu 鉴权失败 path={} 无 Authorization 头", request.getRequestURI());
            writeUnauthorized(response, "missing authorization header");
            return;
        }
        Object loginId = null;
        try {
            loginId = StpUtil.getLoginIdByToken(token);
        } catch (Exception e) {
            // 诊断日志：token 校验失败原因（只打 8 位前缀，避免 token 泄露）
            log.warn("zhiyu 鉴权失败 path={} token={}... 原因={}",
                request.getRequestURI(),
                token.length() > 8 ? token.substring(0, 8) : token,
                e.getClass().getSimpleName() + ": " + e.getMessage());
            loginId = null;
        }
        if (loginId == null) {
            writeUnauthorized(response, "unauthorized");
            return;
        }

        // 写入请求上下文（等价 Go claims → TenantContext）
        Object userId = StpUtil.getSessionByLoginId(loginId).get("userId");
        Object tenantId = StpUtil.getSessionByLoginId(loginId).get("tenantId");
        Object username = StpUtil.getSessionByLoginId(loginId).get("username");
        Object platform = StpUtil.getSessionByLoginId(loginId).get("platform");
        Object roleCodes = StpUtil.getSessionByLoginId(loginId).get("roleCodes");
        String uid = userId == null ? loginId.toString() : userId.toString();
        String tid = tenantId == null ? null : tenantId.toString();
        // 角色编码（等价 Go claims.RoleCodes，登录时快照进会话；授权拦截器判定用）
        List<String> roleCodeList = null;
        if (roleCodes instanceof Iterable<?> iterable) {
            roleCodeList = new ArrayList<>();
            for (Object code : iterable) {
                if (code != null) {
                    roleCodeList.add(code.toString());
                }
            }
        }

        // 逐请求会话校验（对齐 Go RequireActiveUser：停用即时失效，DB 异常 fail-closed 401）
        try {
            ZhiyuUser u = userMapper.selectById(uid);
            if (u == null || (u.getStatus() != null && !"active".equals(u.getStatus()))) {
                writeUnauthorized(response, "账号已停用");
                return;
            }
            if (tid != null) {
                ZhiyuTenant t = tenantMapper.selectById(tid);
                if (t == null || (t.getStatus() != null && !"active".equals(t.getStatus()))) {
                    writeUnauthorized(response, "租户已停用");
                    return;
                }
            }
        } catch (Exception e) {
            log.warn("zhiyu 会话校验 DB 异常 fail-closed path={} 原因={}", request.getRequestURI(), e.getMessage());
            writeUnauthorized(response, "unauthorized");
            return;
        }

        TenantContext.set(uid, tid,
            username == null ? null : username.toString(),
            platform == null ? null : platform.toString(),
            roleCodeList);
        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * 从 Authorization 头提取 Bearer token。
     */
    private String extractToken(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (StrUtil.isBlank(auth)) {
            return null;
        }
        if (auth.startsWith("Bearer ")) {
            return auth.substring(7).trim();
        }
        return auth.trim();
    }

    /**
     * 输出 401（响应体对齐 Go 中间件 http.Error 文本，无 code 字段）。
     */
    private void writeUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
