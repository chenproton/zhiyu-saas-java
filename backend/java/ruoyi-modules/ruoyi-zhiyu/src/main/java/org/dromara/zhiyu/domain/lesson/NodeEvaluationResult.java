package org.dromara.zhiyu.domain.lesson;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 节点测评结果（node_evaluation_results 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("node_evaluation_results")
public class NodeEvaluationResult extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 节点 ID */
    private String nodeId;

    /** 测评方式键 */
    private String methodKey;

    /** 被评人 ID */
    private String evaluateeId;

    /** 评价人 ID */
    private String evaluatorId;

    /** 评价人类型 */
    private String evaluatorType;

    /** 状态（pending/evaluated） */
    private String status;

    /** 总分 */
    private BigDecimal totalScore;

    /** 满分 */
    private BigDecimal maxScore;

    /** 评分点分数（jsonb，存 JSON 文本） */
    private String evalPointScores;

    /** 客观题答案（jsonb，存 JSON 文本） */
    private String objectiveAnswers;

    /** 主观题内容（jsonb，存 JSON 文本） */
    private String subjectiveContent;

    /** 抽题（jsonb，存 JSON 文本） */
    private String drawnQuestions;

    /** 评语 */
    private String comment;

    /** 评分时间 */
    private OffsetDateTime gradedAt;

    /** 评分人 ID */
    private String gradedBy;

    /** 版本 */
    private String version;
}
