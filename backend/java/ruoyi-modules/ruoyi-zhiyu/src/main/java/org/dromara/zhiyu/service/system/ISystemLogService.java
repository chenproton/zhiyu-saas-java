package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemLoginLog;
import org.dromara.zhiyu.domain.system.SystemOperationLog;

/**
 * 日志服务（对齐 Go log_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemLogService {

    ListResponse<SystemLoginLog> loginLogs(String userId, String status, long limit, long offset);

    ListResponse<SystemOperationLog> operationLogs(String userId, String module, String action, long limit, long offset);

    /**
     * 异步写入操作日志（投递到缓冲队列，批量落库；不阻塞主流程，对齐 Go OpLogBuffer）。
     */
    void enqueueOperationLog(SystemOperationLog entry);

    /**
     * 写入登录日志（同步单条插入，失败仅告警不影响登录，对齐 Go store/auth.go RecordLoginLog）。
     */
    void recordLoginLog(SystemLoginLog entry);
}
