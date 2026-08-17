package org.dromara.zhiyu.service.system;

import java.util.Map;

/**
 * 主题色配置服务（对齐 Go settings_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemSettingsService {

    /** 读取主题色（公开，可选 tenantId 租户覆盖回退平台默认）。 */
    Map<String, String> getTheme(String tenantId);

    /** 平台默认主题色（超管）。 */
    Map<String, String> updateTheme(String primary);

    /** 租户主题色覆盖（超管）。 */
    Map<String, String> updateTenantTheme(String tenantId, String primary);

    /** 清除租户主题色覆盖（回退平台默认）。 */
    Map<String, String> deleteTenantTheme(String tenantId);
}
