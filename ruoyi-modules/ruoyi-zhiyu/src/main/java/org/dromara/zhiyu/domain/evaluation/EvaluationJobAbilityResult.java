package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 岗位能力测评结果（job_ability_results 表）。
 *
 * <p>abilityPointDetails/gradeHistory 为 jsonb（存 JSON 文本）；
 * positionName/studentName/studentNo/department 为关联组装结果。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("job_ability_results")
public class EvaluationJobAbilityResult extends BaseZhiyuEntity {

    /** 岗位 ID */
    private String careerPositionId;

    /** 学生用户 ID */
    private String userId;

    /** 班级名称 */
    private String className;

    /** 专业 ID */
    private String majorId;

    /** 专业名称 */
    private String majorName;

    /** 总能力点数 */
    private Integer totalAbilityPoints;

    /** 达标能力点数 */
    private Integer achievedAbilityPoints;

    /** 达标率（%） */
    private BigDecimal achievementRate;

    /** 等级（已停用，列保留置空） */
    private String grade;

    /** 能力点明细（jsonb 数组 JSON 文本） */
    private String abilityPointDetails;

    /** 等级历史（jsonb 数组 JSON 文本） */
    private String gradeHistory;

    /** 能力认知得分（0-100） */
    private BigDecimal abilityCognitionScore;

    /** 岗位胜任度（%） */
    private BigDecimal positionCompetency;

    /** 岗位胜任度（新，%） */
    private BigDecimal positionCompetencyV2;

    /** 评价时间 */
    private OffsetDateTime evaluatedAt;

    /** 租户 ID */
    private String tenantId;
}
