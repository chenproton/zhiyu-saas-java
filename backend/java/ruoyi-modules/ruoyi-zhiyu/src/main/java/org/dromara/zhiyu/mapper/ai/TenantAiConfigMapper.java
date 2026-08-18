package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Insert;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.TenantAiConfig;

/**
 * 租户 AI 配置 Mapper（tenant_ai_configs 表）。
 *
 * @author zhiyu
 */
public interface TenantAiConfigMapper extends BaseMapperPlus<TenantAiConfig, TenantAiConfig> {

    /** 写入配置（不存在则插入，存在则更新并刷新 updated_at） */
    @Insert("INSERT INTO tenant_ai_configs (tenant_id, base_url, api_key_encrypted, model, extra)"
        + " VALUES (#{tenantId}, #{baseUrl}, #{apiKeyEncrypted}, #{model}, '{}'::jsonb)"
        + " ON CONFLICT (tenant_id) DO UPDATE SET base_url = EXCLUDED.base_url,"
        + " api_key_encrypted = EXCLUDED.api_key_encrypted, model = EXCLUDED.model, updated_at = now()")
    int upsert(TenantAiConfig config);
}
