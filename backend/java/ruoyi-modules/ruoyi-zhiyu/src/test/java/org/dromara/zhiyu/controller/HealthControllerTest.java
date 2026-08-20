package org.dromara.zhiyu.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * 健康检查端点单测（compose healthcheck 与 deploy.sh 冒烟探针依赖 /health）。
 */
@Tag("local")
class HealthControllerTest {

    private final HealthController controller = new HealthController();

    @Test
    @DisplayName("/health 返回 status=ok")
    void healthOk() {
        Map<String, String> body = controller.health();
        assertEquals("ok", body.get("status"));
        assertEquals(1, body.size());
    }
}
