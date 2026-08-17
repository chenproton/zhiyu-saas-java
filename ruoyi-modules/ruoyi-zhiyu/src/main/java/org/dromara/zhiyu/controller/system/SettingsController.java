package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.service.system.ISystemSettingsService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 公开主题色控制器（对齐 Go settings_handler.GetTheme 的 /settings/theme 路由，登录前加载）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/settings")
public class SettingsController {

    private final ISystemSettingsService settingsService;

    @GetMapping("/theme")
    public Map<String, String> getTheme(@RequestParam(value = "tenantId", required = false) String tenantId) {
        return settingsService.getTheme(tenantId);
    }
}
