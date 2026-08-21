package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;

/**
 * 测评评分规则（task_eval_score_rules 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("task_eval_score_rules")
public class SceneScoreRule extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 所属测评方法配置 ID */
    private String configId;

    /** 规则名称 */
    private String name;

    /** 描述 */
    private String description;

    /** 规则内容 */
    private String rule;

    /** 权重 */
    private BigDecimal weight;

    /** 排序序号 */
    private Integer sortOrder;
}
