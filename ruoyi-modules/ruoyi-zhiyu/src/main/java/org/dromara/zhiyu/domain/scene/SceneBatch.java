package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 场景批次（scene_batches 表，Go→Java 迁移）。
 *
 * <p>majorName 为 LEFT JOIN majors 的结果列（非本表列）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("scene_batches")
public class SceneBatch extends BaseZhiyuEntity {

    /** 批次名称 */
    private String name;

    /** 批次编码 */
    private String code;

    /** 组织节点 ID */
    private String orgNodeId;

    /** 专业 ID */
    private String majorId;

    /** 专业名称（JOIN majors，非表列） */
    @TableField(exist = false)
    private String majorName;

    /** 工作流 ID */
    private String workflowId;

    /** 状态（open/closed） */
    private String status;

    /** 场景数量 */
    private Integer scenarioCount;

    /** 租户 ID */
    private String tenantId;
}
