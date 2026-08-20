package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemLoginLog;
import org.dromara.zhiyu.domain.system.SystemOperationLog;
import org.dromara.zhiyu.mapper.system.SystemLoginLogMapper;
import org.dromara.zhiyu.mapper.system.SystemOperationLogMapper;
import org.dromara.zhiyu.service.system.ISystemLogService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 日志服务实现（对齐 Go log_handler.go + store/logs.go）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class SystemLogServiceImpl implements ISystemLogService {

    private final SystemLoginLogMapper loginLogMapper;
    private final SystemOperationLogMapper operationLogMapper;
    private final OperationLogBuffer operationLogBuffer;
    private final SystemGuard guard;

    @Override
    public ListResponse<SystemLoginLog> loginLogs(String userId, String status, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = clampLimit(limit, 50);
        LambdaQueryBuilder<SystemLoginLog> wrapper = QueryBuilder.lambda(SystemLoginLog.class)
            .eq(SystemLoginLog::getTenantId, tenantId);
        if (userId != null && !userId.isBlank()) {
            wrapper.eq(SystemLoginLog::getUserId, userId);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(SystemLoginLog::getStatus, status);
        }
        long total = loginLogMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SystemLoginLog::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<SystemLoginLog> items = loginLogMapper.selectList(wrapper.build());
        return ListResponse.of(items, total);
    }

    @Override
    public ListResponse<SystemOperationLog> operationLogs(String userId, String module, String action, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = clampLimit(limit, 50);
        LambdaQueryBuilder<SystemOperationLog> wrapper = QueryBuilder.lambda(SystemOperationLog.class)
            .eq(SystemOperationLog::getTenantId, tenantId);
        if (userId != null && !userId.isBlank()) {
            wrapper.eq(SystemOperationLog::getUserId, userId);
        }
        if (module != null && !module.isBlank()) {
            wrapper.eq(SystemOperationLog::getModule, module);
        }
        if (action != null && !action.isBlank()) {
            wrapper.eq(SystemOperationLog::getAction, action);
        }
        long total = operationLogMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SystemOperationLog::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<SystemOperationLog> items = operationLogMapper.selectList(wrapper.build());
        return ListResponse.of(items, total);
    }

    @Override
    public void enqueueOperationLog(SystemOperationLog entry) {
        operationLogBuffer.enqueue(entry);
    }

    @Override
    public void recordLoginLog(SystemLoginLog entry) {
        try {
            loginLogMapper.insert(entry);
        } catch (Exception e) {
            // 对齐 Go：登录日志写入失败只告警，不影响登录主流程
            log.warn("zhiyu 登录日志写入失败 userId={} 原因={}", entry.getUserId(), e.getMessage());
        }
    }

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }
}
