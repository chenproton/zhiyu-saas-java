package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.OffsetDateTime;

/**
 * 岗位能力汇聚日志（job_ability_aggregate_logs 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("job_ability_aggregate_logs")
public class EvaluationJobAbilityLog extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 岗位 ID */
    private String careerPositionId;

    /** 状态（running/finished/failed） */
    private String status;

    /** 候选学生数 */
    private Integer studentCount;

    /** 更新行数 */
    private Integer updatedCount;

    /** 错误信息 */
    private String errorMessage;

    /** 开始时间 */
    private OffsetDateTime startedAt;

    /** 结束时间 */
    private OffsetDateTime finishedAt;
}
