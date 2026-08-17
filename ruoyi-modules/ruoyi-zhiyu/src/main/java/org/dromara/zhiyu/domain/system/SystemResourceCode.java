package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 资源编码（resource_codes 表，仅 created_at 列）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("resource_codes")
public class SystemResourceCode {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 编码 */
    private String code;

    /** 名称 */
    private String name;

    /** 描述 */
    private String description;

    /** 类型（public/custom） */
    private String type;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
