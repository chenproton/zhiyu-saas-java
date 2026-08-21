package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.system.SystemSubscriptionPackage;
import org.dromara.zhiyu.service.system.ISystemTenantService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 门户侧订阅控制器（对齐 Go subscription_handler.Get 的 /subscriptions 路由）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/subscriptions")
public class SubscriptionController {

    private final ISystemTenantService tenantService;

    @GetMapping
    public SystemSubscriptionPackage get() {
        return tenantService.getSubscription();
    }
}
