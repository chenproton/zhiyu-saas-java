package org.dromara.zhiyu.domain.dto.partner;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 任务测评方式响应（对齐 Go TaskEvaluationMethod = 方法 + evalPoints/scoreRules/reviewSteps）。
 *
 * <p>evalSubjects/resourceConfig/gradeMapping 为 jsonb 原文，经 {@link JsonRawValue} 原样输出。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TaskEvaluationMethodDto {

    private String id;
    private String taskId;
    private String methodKey;
    private BigDecimal weight;
    private String evalObject;
    private String scoreType;
    @JsonRawValue
    private String evalSubjects;
    private String rubricTemplateId;
    private String standardName;
    private String standardMode;
    @JsonRawValue
    private String resourceConfig;
    private Integer version;
    private Boolean isEnabled;
    private List<EvalPoint> evalPoints;
    private List<ScoreRule> scoreRules;
    private List<ReviewStep> reviewSteps;

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EvalPoint {
        private String id;
        private String configId;
        private String name;
        private String description;
        private String subType;
        private List<String> types;
        private BigDecimal weight;
        private String scoringMethod;
        @JsonRawValue
        private String gradeMapping;
        private List<String> knowledgePointIds;
        private List<String> abilityPointIds;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ScoreRule {
        private String id;
        private String configId;
        private String name;
        private String description;
        private String rule;
        private BigDecimal weight;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ReviewStep {
        private String id;
        private String configId;
        private String label;
        private String description;
        private Boolean enabled;
        private String subjectType;
        private List<String> assignedUserIds;
        private BigDecimal weight;
        private Integer sortOrder;
    }
}
