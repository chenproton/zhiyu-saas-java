package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonMapTypeHandler;

import java.util.Map;

/**
 * 订阅套餐（subscription_packages 表，modules 为 jsonb）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("subscription_packages")
public class SystemSubscriptionPackage extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 套餐名 */
    private String name;

    /** 有效期止（YYYY-MM-DD，空为不限） */
    private String validUntil;

    /** 模块开关（jsonb） */
    @TableField(typeHandler = JsonMapTypeHandler.class)
    private Map<String, Object> modules;

    /** 状态（active/inactive） */
    private String status;

    /** AI token 额度 */
    private Long aiTokenQuota;
}
