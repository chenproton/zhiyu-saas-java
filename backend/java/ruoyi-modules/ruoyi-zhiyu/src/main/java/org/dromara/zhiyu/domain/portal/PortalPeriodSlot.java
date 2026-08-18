package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.LocalTime;

/**
 * 节次（period_slots 表，无 created_at/updated_at 列，故不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("period_slots")
public class PortalPeriodSlot {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 节次名称 */
    private String name;

    /** 排序 */
    private Integer sortOrder;

    /** 时段类型（morning_self/morning/afternoon/evening） */
    private String slotType;

    /** 开始时间（time without time zone） */
    private LocalTime startTime;

    /** 结束时间（time without time zone） */
    private LocalTime endTime;
}
