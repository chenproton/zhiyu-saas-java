package org.dromara.zhiyu.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 健康检查端点（部署探针用，等价 Go 版 /health 语义）。
 *
 * <p>compose healthcheck 与 deploy.sh 冒烟探针均依赖本端点；
 * 不要求鉴权（与 Go 版 /health 一致，健康探针无法携带登录态）。</p>
 *
 * @author zhiyu
 */
@RestController
public class HealthController {

    /** 存活探针：后端进程可响应即返回 ok（DB/Redis 探活由业务冒烟覆盖） */
    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
