package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 阅读计数（view_counters 表，复合主键 target_type+target_id）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("view_counters")
public class PortalViewCounter {

    /** 目标类型 */
    @TableId(value = "target_type", type = IdType.INPUT)
    private String targetType;

    /** 目标 ID */
    private String targetId;

    /** 计数 */
    private Long cnt;

    /** 更新时间 */
    private OffsetDateTime updatedAt;
}
