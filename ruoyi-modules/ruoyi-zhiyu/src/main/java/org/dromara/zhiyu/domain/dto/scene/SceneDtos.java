package org.dromara.zhiyu.domain.dto.scene;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 场景 scene 域 DTO（对齐 Go scene 相关 handler 与 shared-types scene.ts）。
 *
 * @author zhiyu
 */
public class SceneDtos {

    // ---------- 场景 scenarios ----------

    /** 创建场景请求（CreateScenarioRequest） */
    @Data
    public static class CreateScenarioRequest {
        private String name;
        private String code;
        private String coverImage;
        private String careerPositionId;
        private List<String> industryIds;
        private List<String> professionIds;
        private String batchId;
        private Integer difficulty;
        private String version;
        private String background;
        private String deliveryGoal;
        private List<String> coBuilderIds;
    }

    /** 更新场景请求（部分更新：null 字段保留原值，对齐 Go Nullable* 合并语义） */
    @Data
    public static class UpdateScenarioRequest {
        private String name;
        private String code;
        private String coverImage;
        private String careerPositionId;
        private List<String> industryIds;
        private List<String> professionIds;
        private String batchId;
        private Integer difficulty;
        private String version;
        private String background;
        private String deliveryGoal;
        private List<String> coBuilderIds;
    }

    /** 场景条目（Scenario，对齐 shared-types scene.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ScenarioDto {
        private String id;
        private String name;
        private String code;
        private String coverImage;
        private String careerPositionId;
        private List<String> industryIds;
        private List<String> industryNames;
        private List<String> professionIds;
        private List<String> professionNames;
        private String batchId;
        private Integer difficulty;
        private String version;
        private Integer viewCount;
        private String status;
        private String sourceType;
        private String sourceEnterpriseId;
        private String background;
        private String deliveryGoal;
        private String creatorId;
        private String creatorName;
        private List<String> coBuilderIds;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private OffsetDateTime publishTime;
        private Integer taskCount;
    }

    /** 审核请求（ContentReviewRequest） */
    @Data
    public static class ReviewRequest {
        private String status;
        private String comment;
    }

    /** 邀请协作者请求（InviteRequest） */
    @Data
    public static class InviteRequest {
        private String userId;
    }

    /** 克隆场景请求（CloneScenarioRequest） */
    @Data
    public static class CloneRequest {
        private String name;
        private String code;
    }

    // ---------- 场景任务 tasks ----------

    /** 创建/更新任务请求（CreateScenarioTaskRequest） */
    @Data
    public static class CreateScenarioTaskRequest {
        private String scenarioId;
        private String name;
        private String code;
        private Integer sortOrder;
        private String description;
        private String detailedDescription;
        private String descriptionPdf;
        private BigDecimal estimatedHours;
        private String taskType;
        private Integer difficulty;
        private String background;
        private List<String> dependencyIds;
        private Boolean isReferenced;
        private String sourceScenarioId;
        private List<String> knowledgePointIds;
        private List<String> abilityPointIds;
        private List<String> resourceIds;
        private Map<String, Object> evalData;
    }

    /** 任务重排请求（ReorderScenarioTasksRequest） */
    @Data
    public static class ReorderTasksRequest {
        private String scenarioId;
        private List<String> taskIds;
    }

    /** 任务条目（ScenarioTask，对齐 shared-types scene.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ScenarioTaskDto {
        private String id;
        private String scenarioId;
        private String name;
        private String code;
        private Integer sortOrder;
        private String description;
        private String detailedDescription;
        private String descriptionPdf;
        private BigDecimal estimatedHours;
        private String taskType;
        private Integer difficulty;
        private String background;
        private List<String> dependencyIds;
        private Boolean isReferenced;
        private String sourceScenarioId;
        private List<String> knowledgePointIds;
        private List<String> knowledgePointNames;
        private List<String> abilityPointIds;
        private List<String> abilityPointNames;
        private List<String> resourceIds;
        private Map<String, Object> evalData;
        private String tenantId;
    }

    // ---------- 场景权重 weights ----------

    /** 权重 upsert 请求（UpsertScenarioWeightRequest） */
    @Data
    public static class WeightRequest {
        private String id;
        private String scenarioId;
        private String taskId;
        private BigDecimal weight;
    }

    /** 权重条目（ScenarioWeightConfig） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WeightDto {
        private String id;
        private String scenarioId;
        private String taskId;
        private BigDecimal weight;
    }

    // ---------- 场景批次 batches ----------

    /** 创建批次请求（BatchCreateRequest） */
    @Data
    public static class BatchCreateRequest {
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String workflowId;
        private String status;
    }

    /** 更新批次请求（BatchUpdateRequest） */
    @Data
    public static class BatchUpdateRequest {
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String workflowId;
        private String status;
    }

    /** 更新批次状态请求（BatchUpdateStatusRequest） */
    @Data
    public static class BatchStatusRequest {
        private String status;
    }

    /** 批次条目（SceneBatch，对齐 shared-types scene.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BatchDto {
        private String id;
        private String tenantId;
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String majorName;
        private String workflowId;
        private String status;
        private Integer scenarioCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ---------- 任务资源 task-resources ----------

    /** 创建任务资源请求（CreateTaskResourceRequest） */
    @Data
    public static class CreateTaskResourceRequest {
        private String name;
        private String type;
        private String url;
        private String description;
        private String thumbnail;
        private String size;
        private List<String> knowledgePointIds;
        private Map<String, Object> extraData;
    }

    /** 绑定资源请求（BindTaskResourceRequest） */
    @Data
    public static class BindResourceRequest {
        private String taskId;
        private String resourceId;
    }

    /** 任务资源条目（TaskResource，对齐 shared-types scene.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TaskResourceDto {
        private String id;
        private String name;
        private String type;
        private String url;
        private String description;
        private String thumbnail;
        private String size;
        private List<String> knowledgePointIds;
        private Map<String, Object> extraData;
        private String uploadedBy;
        private OffsetDateTime uploadedAt;
    }

    // ---------- 测评方式 evaluation-methods ----------

    /** 保存测评方式请求（SaveTaskEvaluationMethodsRequest） */
    @Data
    public static class SaveEvalMethodsRequest {
        private Integer version;
        private List<TaskEvaluationMethodInput> methods;
    }

    /** 测评方法输入（TaskEvaluationMethodInput） */
    @Data
    public static class TaskEvaluationMethodInput {
        private String methodKey;
        private BigDecimal weight;
        private String evalObject;
        private String scoreType;
        private Object evalSubjects;
        private String standardName;
        private String standardMode;
        private Object resourceConfig;
        private Boolean isEnabled;
        private List<EvalPointInput> evalPoints;
        private List<ScoreRuleInput> scoreRules;
        private List<ReviewStepInput> reviewSteps;
    }

    /** 评分规则输入（ScoreRuleInput） */
    @Data
    public static class ScoreRuleInput {
        private String name;
        private String description;
        private String rule;
        private BigDecimal weight;
        private Integer sortOrder;
    }

    /** 评估点输入（EvalPointInput） */
    @Data
    public static class EvalPointInput {
        private String name;
        private String description;
        private String subType;
        private List<String> types;
        private BigDecimal weight;
        private String scoringMethod;
        private Object gradeMapping;
        private List<String> knowledgePointIds;
        private List<String> abilityPointIds;
        private Integer sortOrder;
    }

    /** 评审步骤输入（ReviewStepInput） */
    @Data
    public static class ReviewStepInput {
        private String label;
        private String description;
        private Boolean enabled;
        private String subjectType;
        private BigDecimal weight;
        private Integer sortOrder;
        private List<String> assignedUserIds;
    }

    /** 测评方式列表响应（TaskEvaluationMethodListResponse） */
    @Data
    public static class EvalMethodListResponse {
        private List<TaskEvaluationMethodDto> methods;
    }

    /** 测评方式（TaskEvaluationMethod，对齐 shared-types scene.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TaskEvaluationMethodDto {
        private String id;
        private String taskId;
        private String methodKey;
        private BigDecimal weight;
        private String evalObject;
        private String scoreType;
        private List<Object> evalSubjects;
        private String rubricTemplateId;
        private String standardName;
        private String standardMode;
        private Map<String, Object> resourceConfig;
        private Integer version;
        private Boolean isEnabled;
        private List<TaskEvalPointDto> evalPoints;
        private List<TaskScoreRuleDto> scoreRules;
        private List<TaskReviewStepDto> reviewSteps;
    }

    /** 评估点（TaskEvalPoint） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TaskEvalPointDto {
        private String id;
        private String configId;
        private String name;
        private String description;
        private String subType;
        private List<String> types;
        private BigDecimal weight;
        private String scoringMethod;
        private List<Object> gradeMapping;
        private List<String> knowledgePointIds;
        private List<String> abilityPointIds;
        private Integer sortOrder;
    }

    /** 评分规则（TaskScoreRule） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TaskScoreRuleDto {
        private String id;
        private String configId;
        private String name;
        private String description;
        private String rule;
        private BigDecimal weight;
        private Integer sortOrder;
    }

    /** 评审步骤（TaskReviewStep，assignedUserIds 恒输出） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TaskReviewStepDto {
        private String id;
        private String configId;
        private String label;
        private String description;
        private Boolean enabled;
        private String subjectType;
        private BigDecimal weight;
        private Integer sortOrder;
        private List<String> assignedUserIds;
    }

    // ---------- 评分模板 rubric-templates ----------

    /** 评分模板请求（RubricTemplateInput） */
    @Data
    public static class RubricTemplateRequest {
        private String name;
        private String mode;
        private List<String> types;
        private String description;
        private Map<String, Object> data;
    }

    /** 评分模板条目（RubricTemplate） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RubricTemplateDto {
        private String id;
        private String tenantId;
        private String name;
        private String mode;
        private List<String> types;
        private String description;
        private Map<String, Object> data;
        private Boolean isDeleted;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ---------- 等级映射 grade-mappings ----------

    /** 等级映射 upsert 请求（UpsertScenarioGradeMappingRequest） */
    @Data
    public static class GradeMappingRequest {
        private String id;
        private String scenarioId;
        private String taskId;
        private String level;
        private BigDecimal minScore;
        private BigDecimal maxScore;
        private String description;
        private String color;
    }

    /** 等级映射条目（ScenarioGradeMapping） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class GradeMappingDto {
        private String id;
        private String scenarioId;
        private String taskId;
        private String level;
        private BigDecimal minScore;
        private BigDecimal maxScore;
        private String description;
        private String color;
    }

    // ---------- 任务绑定 task-bindings ----------

    /** 绑定知识点请求（BindTaskKnowledgeRequest） */
    @Data
    public static class BindKnowledgeRequest {
        private String taskId;
        private String knowledgePointId;
    }

    /** 绑定能力点请求（BindTaskAbilityRequest） */
    @Data
    public static class BindAbilityRequest {
        private String taskId;
        private String abilityPointId;
    }

    /** 任务-知识点绑定条目（TaskKnowledgeBinding） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TaskKnowledgeBindingDto {
        private String id;
        private String taskId;
        private String knowledgePointId;
    }

    /** 任务-能力点绑定条目（TaskAbilityBinding） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TaskAbilityBindingDto {
        private String id;
        private String taskId;
        private String abilityPointId;
    }
}
