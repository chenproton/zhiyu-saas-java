package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 租户 AI 配置（tenant_ai_configs 表，Go→Java 迁移）。
 *
 * <p>主键为 tenant_id（非 id），不继承 BaseZhiyuEntity；api_key_encrypted 为密文，
 * 永不下发前端、不打日志（红线）。extra 为 jsonb，演示环境不解析。</p>
 *
 * @author zhiyu
 */
@Data
@TableName("tenant_ai_configs")
public class TenantAiConfig {

    /** 租户 ID（主键） */
    @TableId(value = "tenant_id", type = IdType.INPUT)
    private String tenantId;

    /** 上游 base_url */
    private String baseUrl;

    /** api_key 密文（AES-256-GCM，永不下发） */
    @JsonIgnore
    private String apiKeyEncrypted;

    /** 模型 */
    private String model;

    /** 扩展字段（jsonb） */
    @JsonIgnore
    @TableField("extra")
    private String extra;

    /** 创建时间 */
    private OffsetDateTime createdAt;

    /** 更新时间 */
    private OffsetDateTime updatedAt;
}
