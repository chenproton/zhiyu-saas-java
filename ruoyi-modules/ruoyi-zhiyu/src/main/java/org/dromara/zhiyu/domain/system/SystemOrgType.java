package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 组织类型（org_types 表，仅 created_at 列，故不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("org_types")
public class SystemOrgType {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 名称 */
    private String name;

    /** 分类（internal/business/external） */
    private String category;

    /** 描述 */
    private String description;

    /** 是否默认 */
    private Boolean isDefault;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
