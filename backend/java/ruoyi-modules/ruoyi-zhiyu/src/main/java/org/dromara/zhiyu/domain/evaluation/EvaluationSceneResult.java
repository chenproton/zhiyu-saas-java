package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 场景任务测评结果（scene_evaluation_results 表）。
 *
 * <p>evalPointScores/objectiveAnswers/subjectiveContent/drawnQuestions 为 jsonb 对象
 * （存 JSON 文本），Service 层解析为 Map 输出 DTO。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("scene_evaluation_results")
public class EvaluationSceneResult extends BaseZhiyuEntity {

    /** 场景任务 ID */
    private String taskId;

    /** 场景 ID */
    private String sceneId;

    /** 测评方式（random_draw/review/paper/question_bank/outcome/homework/quiz） */
    private String methodKey;

    /** 被评价人（学生） */
    private String evaluateeId;

    /** 评价人 */
    private String evaluatorId;

    /** 评价人类型 */
    private String evaluatorType;

    /** 状态（pending/evaluated） */
    private String status;

    /** 总分 */
    private BigDecimal totalScore;

    /** 满分 */
    private BigDecimal maxScore;

    /** 评分点得分（jsonb 对象 JSON 文本） */
    private String evalPointScores;

    /** 客观题作答（jsonb 对象 JSON 文本） */
    private String objectiveAnswers;

    /** 主观内容（jsonb 对象 JSON 文本） */
    private String subjectiveContent;

    /** 抽题记录（jsonb 对象 JSON 文本） */
    private String drawnQuestions;

    /** 评语 */
    private String comment;

    /** 评分时间 */
    private OffsetDateTime gradedAt;

    /** 评分人 */
    private String gradedBy;

    /** 提交时盖章的场景快照版本 */
    private String version;

    /** 租户 ID */
    private String tenantId;
}
