package org.dromara.zhiyu.core.web;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * zhiyu 模块异常处理（优先级高于框架 GlobalExceptionHandler）。
 *
 * <p>只处理 {@link ApiException}，输出 Go 版 errorResponse 形状：
 * {@code {"code": "...", "error": "...", "message": "..."}}；其余异常继续由框架
 * 全局处理器兜底，不影响框架 R&lt;T&gt; 响应体系。</p>
 *
 * @author zhiyu
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackages = "org.dromara.zhiyu")
public class ApiExceptionHandler {

    /**
     * 错误响应体（对齐 Go handler.errorResponse：message 有 omitempty，null 不输出）。
     */
    public record ErrorBody(String code, String error,
                            @com.fasterxml.jackson.annotation.JsonInclude(
                                com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
                            String message) {
    }

    /**
     * 处理 zhiyu 业务异常。
     *
     * @param e 业务异常
     * @return 对齐 Go 版错误响应
     */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorBody> handleApiException(ApiException e) {
        ErrorBody body = new ErrorBody(e.getCode(), e.getMessage(), null);
        return ResponseEntity.status(e.getStatus()).body(body);
    }

    /** 排课冲突（409，响应体带 conflicts 数组）。 */
    @ExceptionHandler(ScheduleConflictException.class)
    public ResponseEntity<java.util.Map<String, Object>> handleScheduleConflict(ScheduleConflictException e) {
        return ResponseEntity.status(409)
            .body(java.util.Map.of("error", "排课冲突", "conflicts", e.getConflicts()));
    }
}
