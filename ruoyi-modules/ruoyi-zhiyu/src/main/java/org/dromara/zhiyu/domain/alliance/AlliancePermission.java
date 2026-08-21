package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 联盟权限项（alliance_permissions 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_permissions")
public class AlliancePermission extends BaseZhiyuEntity {

    private String tenantId;
    private String accountName;
    private String accountType;
    private String enterpriseId;
    private String expertId;
    private Boolean isEnabled;
    /** jsonb 任意数组（resource_permissions），JSON 原文 */
    private String resourcePermissions;
    /** jsonb 字符串数组（platform_permissions），JSON 原文 */
    private String platformPermissions;
}
