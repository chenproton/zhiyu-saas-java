package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 平台配置（platform_configs 表，key 主键）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("platform_configs")
public class PortalPlatformConfig {

    /** 配置键 */
    @TableId("key")
    private String key;

    /** 配置值 */
    private String value;
}
