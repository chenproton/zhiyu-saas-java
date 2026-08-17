package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 审批记录（approval_records 表，Go→Java 迁移）。
 *
 * <p>history 为 jsonb 数组列（评审历史对象数组），实体保存原始 JSON 文本，
 * 由 Service 与 DTO 之间做 JSON 转换（与 Go JSONSlice 语义一致）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("approval_records")
public class JobApprovalRecord extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 审批对象类型（career_position/scenario/course/question_bank/exam/training_program/teaching_plan） */
    private String targetType;

    /** 审批对象 ID */
    private String targetId;

    /** 工作流 ID */
    private String workflowId;

    /** 当前步骤索引 */
    private Integer currentStepIdx;

    /** 审批状态（pending/approved/rejected） */
    private String status;

    /** 提交人 ID */
    private String submitterId;

    /** 评审历史（jsonb，原始 JSON 文本） */
    private String history;
}
