package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 岗位认证规则（certification_rules 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("certification_rules")
public class EvaluationCertificationRule extends BaseZhiyuEntity {

    /** 岗位 ID */
    private String careerPositionId;

    /** 状态（draft/not_submitted/reviewing/rejected/ready/published） */
    private String status;

    /** 规则来源（inherit/custom） */
    private String ruleSource;

    /** 规则级全局等级映射（jsonb 数组 JSON 文本） */
    private String levelMapping;

    /** 租户 ID */
    private String tenantId;
}
