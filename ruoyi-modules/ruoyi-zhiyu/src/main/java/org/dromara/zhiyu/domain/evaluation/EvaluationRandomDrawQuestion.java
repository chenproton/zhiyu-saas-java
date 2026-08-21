package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 随机抽题（现场问答题，random_draw_questions 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("random_draw_questions")
public class EvaluationRandomDrawQuestion extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 名称 */
    private String name;

    /** 描述 */
    private String description;

    /** 参考答案 */
    private String answer;

    /** 专业 ID */
    private String majorId;
}
