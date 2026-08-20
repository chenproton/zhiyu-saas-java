package org.dromara.zhiyu.core.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.ServletUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.zhiyu.domain.system.SystemOperationLog;
import org.dromara.zhiyu.service.system.ISystemLogService;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * zhiyu /api/v1 操作日志过滤器（对齐 Go internal/middleware/oplog.go 的 OperationLog）。
 *
 * <p>挂在 {@link ZhiyuAuthFilter}（Order 1）与 {@link ZhiyuRateLimitFilter}（Order 2）
 * 之后：仅审计通过鉴权的写请求（POST/PUT/DELETE），跳过行为埋点与浏览数路径；
 * 无租户上下文（未登录/平台级账号）不记录，与 Go 一致。响应状态 ≥400 记 failed，
 * 否则 success；detail 为「方法 + 路径」。写入经异步缓冲批量落库，不阻塞主流程。</p>
 *
 * @author zhiyu
 */
@Slf4j
@Order(3)
@Component
@RequiredArgsConstructor
public class ZhiyuOperationLogFilter extends OncePerRequestFilter {

    private final ISystemLogService logService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!request.getRequestURI().startsWith("/api/v1/")) {
            return true;
        }
        return !OperationLogDescriber.shouldRecord(request.getMethod(), request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        chain.doFilter(request, response);

        // 对齐 Go：claims 缺失或无租户时不记录（登录等公开接口、平台级账号）
        String tenantId = TenantContext.getTenantId();
        if (StringUtils.isBlank(tenantId)) {
            return;
        }
        try {
            String path = request.getRequestURI();
            OperationLogDescriber.OpDescription op =
                OperationLogDescriber.describe(request.getMethod(), path);

            SystemOperationLog entry = new SystemOperationLog();
            entry.setTenantId(tenantId);
            entry.setUserId(TenantContext.getUserId());
            entry.setUserName(TenantContext.getUsername());
            entry.setModule(op.module());
            entry.setAction(op.action());
            entry.setTargetType(op.targetType());
            entry.setTargetId(op.targetId());
            entry.setDetail(request.getMethod() + " " + path);
            entry.setIp(ServletUtils.getClientIP(request));
            entry.setStatus(response.getStatus() >= 400 ? "failed" : "success");
            logService.enqueueOperationLog(entry);
        } catch (Exception e) {
            // 审计失败不得影响已完成的业务响应
            log.warn("zhiyu 操作日志记录失败 path={} 原因={}", request.getRequestURI(), e.getMessage());
        }
    }
}
