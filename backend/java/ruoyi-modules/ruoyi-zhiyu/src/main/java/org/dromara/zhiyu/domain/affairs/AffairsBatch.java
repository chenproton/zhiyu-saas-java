package org.dromara.zhiyu.domain.affairs;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 教务批次（affairs_batches 表，含 created_at/updated_at）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("affairs_batches")
public class AffairsBatch extends BaseZhiyuEntity {

    /** 批次名称 */
    private String name;

    /** 批次编码 */
    private String code;

    /** 组织节点 ID */
    private String orgNodeId;

    /** 专业 ID */
    private String majorId;

    /** 工作流 ID */
    private String workflowId;

    /** 状态（open/closed） */
    private String status;

    /** 方案数量 */
    private Integer programCount;

    /** 已发布数量 */
    private Integer publishedCount;

    /** 待审核数量 */
    private Integer pendingCount;

    /** 租户 ID */
    private String tenantId;

    // ---------- 关联填充（非表列） ----------

    /** 专业名称 */
    @TableField(exist = false)
    private String majorName;
}
