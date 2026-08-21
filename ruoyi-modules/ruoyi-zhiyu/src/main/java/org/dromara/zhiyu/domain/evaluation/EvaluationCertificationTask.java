package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;

/**
 * 认证关联任务（certification_related_tasks 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("certification_related_tasks")
public class EvaluationCertificationTask extends BaseZhiyuEntity {

    /** 认证能力点 ID */
    private String certPointId;

    /** 任务 ID（场景任务） */
    private String taskId;

    /** 任务满分 */
    private BigDecimal maxScore;

    /** 权重 */
    private BigDecimal weight;

    /** 租户 ID */
    private String tenantId;
}
