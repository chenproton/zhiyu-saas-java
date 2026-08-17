package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemLoginLog;
import org.dromara.zhiyu.domain.system.SystemOperationLog;
import org.dromara.zhiyu.service.system.ISystemLogService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 日志控制器（对齐 Go log_handler.go 的 /logs 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/logs")
public class LogController {

    private final ISystemLogService logService;

    @GetMapping("/login")
    public ListResponse<SystemLoginLog> loginLogs(@RequestParam(value = "userId", required = false) String userId,
                                                  @RequestParam(value = "status", required = false) String status,
                                                  @RequestParam(value = "limit", required = false) Long limit,
                                                  @RequestParam(value = "offset", required = false) Long offset) {
        return logService.loginLogs(userId, status, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/operation")
    public ListResponse<SystemOperationLog> operationLogs(@RequestParam(value = "userId", required = false) String userId,
                                                          @RequestParam(value = "module", required = false) String module,
                                                          @RequestParam(value = "action", required = false) String action,
                                                          @RequestParam(value = "limit", required = false) Long limit,
                                                          @RequestParam(value = "offset", required = false) Long offset) {
        return logService.operationLogs(userId, module, action, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }
}
