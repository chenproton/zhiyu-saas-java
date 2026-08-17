package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 试卷题目快照（exam_questions 表，无 created_at/updated_at 列，不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("exam_questions")
public class EvaluationExamQuestion {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 试卷 ID */
    private String examId;

    /** 源题目 ID（questions.id，删除源题后置 NULL 不级联） */
    private String questionId;

    /** 题型 */
    private String type;

    /** 题干快照 */
    private String content;

    /** 选项（jsonb 数组 JSON 文本） */
    private String options;

    /** 答案（JSON 数组文本） */
    private String answer;

    /** 解析 */
    private String analysis;

    /** 分值 */
    private BigDecimal score;

    /** 排序 */
    private Integer sortOrder;

    /** 租户 ID */
    private String tenantId;
}
