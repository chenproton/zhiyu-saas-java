package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;

/**
 * 认证能力点（certification_ability_points 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("certification_ability_points")
public class EvaluationCertificationPoint extends BaseZhiyuEntity {

    /** 能力项 ID */
    private String itemId;

    /** 能力点 ID（ability_points.id） */
    private String abilityPointId;

    /** 映射类型（inherit/custom） */
    private String mappingType;

    /** 自定义分档（jsonb 数组 JSON 文本） */
    private String customLevelMapping;

    /** 要求掌握程度（understand/comprehend/master/proficient/expert） */
    private String requiredLevel;

    /** 权重 */
    private BigDecimal weight;

    /** 租户 ID */
    private String tenantId;
}
