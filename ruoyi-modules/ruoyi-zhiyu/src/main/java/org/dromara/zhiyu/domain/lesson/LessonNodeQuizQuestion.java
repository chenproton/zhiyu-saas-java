package org.dromara.zhiyu.domain.lesson;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 节点测验题目（node_quiz_questions 表，Go→Java 迁移）。
 *
 * <p>表无 created_at/updated_at 列，故不继承 BaseZhiyuEntity；options 为 jsonb
 * 列，以 JSON 原文文本承载（读取时 options，写入 CAST 为 jsonb）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("node_quiz_questions")
public class LessonNodeQuizQuestion {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 所属测验 ID */
    private String quizId;

    /** 题型 */
    private String type;

    /** 题干 */
    private String question;

    /** 选项（jsonb，JSON 原文文本） */
    private String options;

    /** 答案（可空） */
    private String answer;

    /** 分值 */
    private BigDecimal score;

    /** 排序号 */
    private Integer sortOrder;

    /** 租户 ID */
    private String tenantId;
}
