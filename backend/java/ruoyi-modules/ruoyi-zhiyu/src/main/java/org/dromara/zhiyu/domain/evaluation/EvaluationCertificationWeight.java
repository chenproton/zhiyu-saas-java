package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;

/**
 * 认证权重配置（certification_weights 表；task_id 为 NULL 的行是能力点占岗位总分的权重）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("certification_weights")
public class EvaluationCertificationWeight extends BaseZhiyuEntity {

    /** 规则 ID */
    private String ruleId;

    /** 能力点 ID */
    private String abilityPointId;

    /** 任务 ID（NULL=能力点级权重） */
    private String taskId;

    /** 权重 */
    private BigDecimal weight;

    /** 租户 ID */
    private String tenantId;
}
