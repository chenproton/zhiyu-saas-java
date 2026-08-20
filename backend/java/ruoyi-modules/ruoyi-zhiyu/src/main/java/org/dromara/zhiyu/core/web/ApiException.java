package org.dromara.zhiyu.core.web;

import lombok.Getter;

import java.io.Serial;

/**
 * zhiyu 业务异常（对齐 Go 版 errorResponse：{code, error, message}）。
 *
 * <p>zhiyu 模块的前端（Vue：portal-vue/plus-ui）期望错误响应形状为
 * {@code {"code": "...", "error": "...", "message": "..."}}，
 * 与框架 R&lt;T&gt; 包装不一致，因此 zhiyu 模块统一抛本异常并走
 * {@link ApiExceptionHandler} 输出。</p>
 *
 * @author zhiyu
 */
@Getter
public class ApiException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    /** HTTP 状态码（401/403/404/500 等） */
    private final int status;

    /** 错误码（英文，前端按此分支，如 forbidden / not_found） */
    private final String code;

    /**
     * 构造业务异常。
     *
     * @param status HTTP 状态码
     * @param code   错误码
     * @param message 人类可读错误信息（写入 error 字段）
     */
    public ApiException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public ApiException(int status, String message) {
        this(status, "error", message);
    }
}
