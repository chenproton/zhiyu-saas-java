package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 申诉记录（appeal_records 表，Go→Java 迁移）。
 *
 * <p>表有 created_at/updated_at 列，故继承 BaseZhiyuEntity。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("appeal_records")
public class EvaluationAppeal extends BaseZhiyuEntity {

    /** 被申诉用户 ID */
    private String userId;

    /** 申诉类型 */
    private String type;

    /** 申诉原因 */
    private String reason;

    /** 状态（pending/approved/rejected） */
    private String status;

    /** 处理备注（可空） */
    private String remark;

    /** 租户 ID */
    private String tenantId;
}
