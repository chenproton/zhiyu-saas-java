package org.dromara.zhiyu.core.web;

import lombok.Getter;

import java.io.Serial;

/**
 * 排课冲突异常（409 响应体带 conflicts 数组，对齐 Go scheduling_handler 的
 * {@code {"error": "排课冲突", "conflicts": [...]}}）。
 *
 * @author zhiyu
 */
@Getter
public class ScheduleConflictException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    private final Object conflicts;

    public ScheduleConflictException(Object conflicts) {
        super("排课冲突");
        this.conflicts = conflicts;
    }
}
