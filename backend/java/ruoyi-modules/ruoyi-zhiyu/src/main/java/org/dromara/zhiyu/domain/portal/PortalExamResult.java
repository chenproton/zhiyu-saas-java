package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;

/**
 * 考试成绩（exam_results 表，学生考试分数查询用）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("exam_results")
public class PortalExamResult extends BaseZhiyuEntity {

    /** 考试安排 ID */
    private String examUsageId;

    /** 学生用户 ID */
    private String userId;

    /** 得分 */
    private BigDecimal score;
}
