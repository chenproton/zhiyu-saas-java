package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 认证能力项（certification_ability_items 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("certification_ability_items")
public class EvaluationCertificationItem extends BaseZhiyuEntity {

    /** 规则 ID */
    private String ruleId;

    /** 名称 */
    private String name;

    /** 排序 */
    private Integer sortOrder;

    /** 租户 ID */
    private String tenantId;
}
