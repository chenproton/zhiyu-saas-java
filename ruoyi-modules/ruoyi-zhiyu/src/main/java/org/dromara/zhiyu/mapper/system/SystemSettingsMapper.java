package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 平台/租户键值配置 Mapper（platform_settings / tenant_settings 表，主题色等）。
 *
 * @author zhiyu
 */
public interface SystemSettingsMapper {

    @Select("SELECT value FROM platform_settings WHERE `key` = #{key}")
    String selectPlatform(@Param("key") String key);

    @Insert("INSERT INTO platform_settings (`key`, value, updated_at) VALUES (#{key}, #{value}, now())"
        + " ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = now()")
    int upsertPlatform(@Param("key") String key, @Param("value") String value);

    @Select("SELECT value FROM tenant_settings WHERE tenant_id = #{tenantId} AND `key` = #{key}")
    String selectTenant(@Param("tenantId") String tenantId, @Param("key") String key);

    @Insert("INSERT INTO tenant_settings (tenant_id, `key`, value, updated_at) VALUES (#{tenantId}, #{key}, #{value}, now())"
        + " ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = now()")
    int upsertTenant(@Param("tenantId") String tenantId, @Param("key") String key, @Param("value") String value);

    @Delete("DELETE FROM tenant_settings WHERE tenant_id = #{tenantId} AND `key` = #{key}")
    int deleteTenant(@Param("tenantId") String tenantId, @Param("key") String key);
}
