package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;

import java.math.BigDecimal;
import java.util.List;

/**
 * 题目（questions 表）。
 *
 * <p>options 为 jsonb 数组（存 JSON 文本字符串），answer 为 text 列（存 JSON 数组文本，
 * 如 ["A"]），Service 层解析为列表输出 DTO。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("questions")
public class EvaluationQuestion extends BaseZhiyuEntity {

    /** 编码（TM-XXXXXXXX，租户内唯一） */
    private String code;

    /** 所属题库 */
    private String bankId;

    /** 题型（single/multiple/judge/fill/essay/short_answer） */
    private String type;

    /** 题干 */
    private String content;

    /** 选项（jsonb 数组 JSON 文本） */
    private String options;

    /** 答案（JSON 数组文本，如 ["A"]） */
    private String answer;

    /** 解析 */
    private String analysis;

    /** 分值 */
    private BigDecimal score;

    /** 难度（easy/medium/hard） */
    private String difficulty;

    /** 知识点 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> knowledgePointIds;

    /** 创建人 */
    private String creatorId;

    /** 来源 */
    private String source;

    /** 状态（draft 起） */
    private String status;

    /** 租户 ID */
    private String tenantId;
}
