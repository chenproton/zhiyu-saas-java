package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 考试成绩（exam_results 表）。
 *
 * <p>answers/gradingScores 为 jsonb 对象（存 JSON 文本），majorName 为关联组装结果。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("exam_results")
public class EvaluationExamResult extends BaseZhiyuEntity {

    /** 考试安排 ID */
    private String examUsageId;

    /** 学生用户 ID */
    private String userId;

    /** 学生姓名 */
    private String studentName;

    /** 班级名称 */
    private String className;

    /** 年级 */
    private String grade;

    /** 专业 ID */
    private String majorId;

    /** 得分 */
    private BigDecimal score;

    /** 总分 */
    private BigDecimal totalScore;

    /** 是否及格（60% 及格线） */
    private Boolean isPass;

    /** 作答内容（jsonb 对象 JSON 文本） */
    private String answers;

    /** 交卷时间 */
    private OffsetDateTime submitTime;

    /** 评分状态（pending/evaluated） */
    private String gradingStatus;

    /** 评分逐题分数（jsonb 对象 JSON 文本） */
    private String gradingScores;

    /** 评分评语 */
    private String gradingComment;

    /** 评分人 */
    private String graderId;

    /** 评分时间 */
    private OffsetDateTime gradedAt;

    /** 交卷时盖章的试卷版本 */
    private String version;

    /** 租户 ID */
    private String tenantId;
}
