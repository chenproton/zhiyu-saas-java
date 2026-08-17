package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 能力点自定义五档分数线（certification_point_levels 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("certification_point_levels")
public class EvaluationCertificationPointLevel extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 岗位 ID */
    private String careerPositionId;

    /** 能力点 ID */
    private String abilityPointId;

    /** 五档分数线（jsonb 数组 JSON 文本） */
    private String levelMapping;
}
