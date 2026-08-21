package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 审批记录（approval_records 表，工作台待办统计用）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("approval_records")
public class PortalApprovalRecord extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 审批对象类型（course/scenario/career_position/question_bank/exam/training_program） */
    private String targetType;

    /** 审批状态（pending/approved/rejected） */
    private String status;
}
