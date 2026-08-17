package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;

/**
 * 场景评价结果（scene_evaluation_results 表，场景任务状态查询用）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("scene_evaluation_results")
public class PortalSceneEvalResult extends BaseZhiyuEntity {

    /** 任务 ID */
    private String taskId;

    /** 被评价人（学生） */
    private String evaluateeId;

    /** 状态（evaluated 等） */
    private String status;

    /** 总分 */
    private BigDecimal totalScore;
}
