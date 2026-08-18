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
}
