package org.dromara.zhiyu.core.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.ServletUtils;
import org.dromara.common.core.utils.StringUtils;
import org.springframework.core.annotation.Order;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * zhiyu /api/v1 限流过滤器（对齐 Go internal/cache/middleware.go 的 RateLimit 语义）。
 *
 * <p>挂在 {@link ZhiyuAuthFilter}（Order 1）之后：已认证请求可读到
 * {@link TenantContext} 的用户 ID 用于按用户限流；公开路径（登录/验证码等）
 * 被鉴权过滤器跳过，本过滤器仍按 IP 限流。</p>
 *
 * <p>计数语义与 Go 逐项对齐：Redis INCR 递增，首次命中设置窗口过期（设置失败回滚删除，
 * 防 key 永久存在导致永久限流）；Redis 异常降级为内存限流（不再 fail-open）。
 * 超限响应 429 + {@code {"error":"too many requests","code":429}}，
 * 并输出 X-RateLimit-Limit/Remaining/Reset 头。Redis key 格式与 Go 完全一致
 * （zhiyu:ratelimit:{ns}:{ip} / zhiyu:ratelimit:user:{ns}:{userId}），
 * 双栈共享 Redis 时同场景共用计数桶。</p>
 *
 * @author zhiyu
 */
@Slf4j
@Order(2)
@Component
@RequiredArgsConstructor
public class ZhiyuRateLimitFilter extends OncePerRequestFilter {

    private final StringRedisTemplate stringRedisTemplate;

    /** Redis 不可用时的内存降级限流器（按 namespace 独立，等价 Go 每个 limiter 实例各自的 fallback） */
    private final Map<String, MemoryRateLimiter> fallbacks = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/v1/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {

        ZhiyuRateLimitRule.Rule rule = ZhiyuRateLimitRule.match(request.getMethod(), request.getRequestURI());
        if (rule == null) {
            chain.doFilter(request, response);
            return;
        }

        String key = buildKey(rule, request);

        // Redis 计数路径；INCR 出错（如 Redis 宕机）降级内存限流，不再 fail-open
        try {
            Long current = stringRedisTemplate.opsForValue().increment(key);
            if (current != null) {
                if (current == 1L
                    && !Boolean.TRUE.equals(stringRedisTemplate.expire(key, rule.window()))) {
                    // 设置过期失败时回滚，避免 key 永久存在导致该用户被永久限流
                    stringRedisTemplate.delete(key);
                }
                writeHeaders(response, rule.limit(), Math.max(0, rule.limit() - current.intValue()),
                    Instant.now().plus(rule.window()).getEpochSecond());
                if (current > rule.limit()) {
                    writeTooManyRequests(response);
                    return;
                }
                chain.doFilter(request, response);
                return;
            }
        } catch (Exception e) {
            log.warn("zhiyu 限流 Redis 异常，降级内存限流 key={} 原因={}", key, e.getMessage());
        }

        // 内存降级路径
        MemoryRateLimiter limiter = fallbacks.computeIfAbsent(rule.namespace(),
            ns -> new MemoryRateLimiter(rule.limit(), rule.window().toMillis()));
        MemoryRateLimiter.Result result = limiter.allow(key, System.currentTimeMillis());
        writeHeaders(response, rule.limit(), result.remaining(), result.resetUnix());
        if (!result.allowed()) {
            writeTooManyRequests(response);
            return;
        }
        chain.doFilter(request, response);
    }

    /**
     * 构造限流 key（与 Go 完全一致）：按用户场景优先取登录用户 ID，未登录退回 IP。
     */
    private String buildKey(ZhiyuRateLimitRule.Rule rule, HttpServletRequest request) {
        if (rule.byUser()) {
            String userId = TenantContext.getUserId();
            if (StringUtils.isNotBlank(userId)) {
                return "zhiyu:ratelimit:user:" + rule.namespace() + ":" + userId;
            }
        }
        return "zhiyu:ratelimit:" + rule.namespace() + ":" + ServletUtils.getClientIP(request);
    }

    private void writeHeaders(HttpServletResponse response, int limit, int remaining, long resetUnix) {
        response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("X-RateLimit-Reset", String.valueOf(resetUnix));
    }

    /**
     * 输出统一的 429 响应（与 Go writeTooManyRequests 一致：code 为数字）。
     */
    private void writeTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"error\":\"too many requests\",\"code\":429}");
    }
}
