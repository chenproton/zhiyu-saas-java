package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.mapper.system.SystemSettingsMapper;
import org.dromara.zhiyu.service.system.ISystemSettingsService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 主题色配置服务实现（对齐 Go settings_handler.go + store/platform_settings_store.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemSettingsServiceImpl implements ISystemSettingsService {

    private static final String KEY_THEME_PRIMARY = "theme_primary";
    private static final String DEFAULT_PRIMARY = "#4862e4";
    private static final Pattern THEME_PATTERN = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private final SystemSettingsMapper settingsMapper;
    private final SystemGuard guard;

    @Override
    public Map<String, String> getTheme(String tenantId) {
        if (tenantId != null && !tenantId.isBlank()) {
            try {
                UUID.fromString(tenantId);
            } catch (IllegalArgumentException e) {
                throw new ApiException(400, "bad_request", "tenantId 格式不正确");
            }
            String value = settingsMapper.selectTenant(tenantId, KEY_THEME_PRIMARY);
            if (value != null && THEME_PATTERN.matcher(value).matches()) {
                return Map.of("primary", value);
            }
        }
        String value = settingsMapper.selectPlatform(KEY_THEME_PRIMARY);
        if (value == null || !THEME_PATTERN.matcher(value).matches()) {
            return Map.of("primary", DEFAULT_PRIMARY);
        }
        return Map.of("primary", value);
    }

    @Override
    public Map<String, String> updateTheme(String primary) {
        guard.requireManagePlatform();
        validate(primary);
        settingsMapper.upsertPlatform(KEY_THEME_PRIMARY, primary);
        return Map.of("primary", primary);
    }

    @Override
    public Map<String, String> updateTenantTheme(String tenantId, String primary) {
        guard.requireManagePlatform();
        validateUuid(tenantId);
        validate(primary);
        settingsMapper.upsertTenant(tenantId, KEY_THEME_PRIMARY, primary);
        return Map.of("primary", primary);
    }

    @Override
    public Map<String, String> deleteTenantTheme(String tenantId) {
        guard.requireManagePlatform();
        validateUuid(tenantId);
        settingsMapper.deleteTenant(tenantId, KEY_THEME_PRIMARY);
        return Map.of("primary", DEFAULT_PRIMARY);
    }

    private void validate(String primary) {
        if (primary == null || !THEME_PATTERN.matcher(primary).matches()) {
            throw new ApiException(400, "bad_request", "主题色必须是 #RRGGBB 格式");
        }
    }

    private void validateUuid(String id) {
        try {
            UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw new ApiException(400, "bad_request", "tenantId 格式不正确");
        }
    }
}
