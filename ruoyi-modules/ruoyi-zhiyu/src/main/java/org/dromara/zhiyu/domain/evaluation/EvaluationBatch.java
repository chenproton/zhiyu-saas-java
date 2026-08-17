package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 评价批次（evaluation_batches 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("evaluation_batches")
public class EvaluationBatch extends BaseZhiyuEntity {

    /** 名称 */
    private String name;

    /** 编码 */
    private String code;

    /** 组织节点 ID */
    private String orgNodeId;

    /** 专业 ID */
    private String majorId;

    /** 工作流 ID */
    private String workflowId;

    /** 状态（open/closed） */
    private String status;

    /** 租户 ID */
    private String tenantId;
}
