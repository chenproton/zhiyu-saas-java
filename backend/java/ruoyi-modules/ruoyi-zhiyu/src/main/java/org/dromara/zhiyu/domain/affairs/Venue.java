package org.dromara.zhiyu.domain.affairs;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 场地（venues 表，仅 created_at 列，故不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("venues")
public class Venue {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 场地名称 */
    private String name;

    /** 场地类型（教室/机房/实训室/实验室/校外基地） */
    private String type;

    /** 容量 */
    private Integer capacity;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
