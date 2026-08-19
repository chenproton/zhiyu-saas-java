package org.dromara.zhiyu.domain.dto.evaluation;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 评价 evaluation 域 DTO（对齐 Go evaluation 相关 handler 与 shared-types
 * evaluation.ts / evaluation-exam.ts / evaluation-scene.ts / certification.ts）。
 *
 * @author zhiyu
 */
public class EvaluationDtos {

    // ==================== 题库 question-banks ====================

    /** 创建/更新题库请求（CreateQuestionBankRequest） */
    @Data
    public static class CreateQuestionBankRequest {
        private String name;
        private String description;
        private String coverImage;
        private List<String> collaboratorIds;
        private List<String> collaboratorDeptIds;
        private String batchId;
        private List<String> knowledgePointIds;
    }

    /** 题库条目（QuestionBank） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QuestionBankDto {
        private String id;
        private String code;
        private String name;
        private String description;
        private String coverImage;
        private String status;
        private Integer questionCount;
        private String creatorId;
        private String creatorName;
        private List<String> collaboratorIds;
        private List<String> collaboratorNames;
        private List<String> collaboratorDeptIds;
        private String batchId;
        private String version;
        private String ownerType;
        private Boolean isDraftPool;
        private List<String> knowledgePointIds;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ==================== 题目 questions ====================

    /** 创建/更新题目请求（CreateQuestionRequest） */
    @Data
    public static class CreateQuestionRequest {
        private String bankId;
        private String type;
        private String content;
        private List<String> options;
        /** 答案（string | string[]，兼容两种入参） */
        private Object answer;
        private String analysis;
        private BigDecimal score;
        private String difficulty;
        private List<String> knowledgePoints;
        private String source;
    }

    /** 批量创建题目请求 */
    @Data
    public static class BatchCreateQuestionsRequest {
        private String bankId;
        private List<CreateQuestionRequest> items;
    }

    /** 题目条目（Question） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QuestionDto {
        private String id;
        private String code;
        private String bankId;
        private String type;
        private String content;
        private List<String> options;
        private List<String> answer;
        private String analysis;
        private BigDecimal score;
        private String difficulty;
        private List<String> knowledgePoints;
        private String creatorId;
        private String source;
        private String status;
        private OffsetDateTime createdAt;
    }

    // ==================== 随机抽题 random-draw-questions ====================

    /** 创建/更新随机抽题请求 */
    @Data
    public static class RandomDrawQuestionRequest {
        private String name;
        private String description;
        private String answer;
        private String majorId;
    }

    /** 随机抽题条目（RandomDrawQuestion） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RandomDrawQuestionDto {
        private String id;
        private String name;
        private String description;
        private String answer;
        private String majorId;
        private String majorName;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ==================== 试卷 exams ====================

    /** 创建/更新试卷请求（CreateExamRequest） */
    @Data
    public static class CreateExamRequest {
        private String name;
        private String description;
        private Integer duration;
        private String coverImage;
        private List<String> collaboratorIds;
        private List<String> collaboratorDeptIds;
        private String batchId;
        private Boolean isTemp;
    }

    /** 试卷题目快照（ExamQuestion） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExamQuestionDto {
        private String id;
        private String examId;
        private String questionId;
        private String type;
        private String content;
        private List<String> options;
        private List<String> answer;
        private String analysis;
        private BigDecimal score;
        private Integer order;
    }

    /** 试卷条目（Exam） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExamDto {
        private String id;
        private String code;
        private String name;
        private String description;
        private String status;
        private BigDecimal totalScore;
        private Integer duration;
        private Integer questionCount;
        private List<ExamQuestionDto> questions;
        private String coverImage;
        private List<String> collaboratorIds;
        private List<String> collaboratorDeptIds;
        private String batchId;
        private String version;
        private String ownerType;
        private String creatorId;
        private String creatorName;
        private List<String> collaboratorNames;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private Boolean isTemp;
    }

    /** 试卷添加题目请求 */
    @Data
    public static class AddExamQuestionRequest {
        private String questionId;
        private BigDecimal score;
    }

    /** 试卷题目改分请求 */
    @Data
    public static class UpdateExamQuestionScoreRequest {
        private BigDecimal score;
    }

    // ==================== 考试安排 exam-usages ====================

    /** 创建/更新考试安排请求（ExamUsageRequest） */
    @Data
    public static class ExamUsageRequest {
        private String examId;
        private String name;
        private String description;
        private OffsetDateTime startTime;
        private OffsetDateTime endTime;
        private Integer duration;
        private String targetType;
        private List<String> targetIds;
        private String activationMode;
    }

    /** 考试安排条目（ExamUsage） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExamUsageDto {
        private String id;
        private String examId;
        private String name;
        private String description;
        private OffsetDateTime startTime;
        private OffsetDateTime endTime;
        private Integer duration;
        private String targetType;
        private List<String> targetIds;
        private String status;
        private String activationMode;
        private String examVersion;
        private String creatorId;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 考试中心条目（ExamCenterItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExamCenterItemDto {
        private String id;
        private String examId;
        private String usageName;
        private String examName;
        private String description;
        private OffsetDateTime startTime;
        private OffsetDateTime endTime;
        private Integer duration;
        private String status;
        private Integer questionCount;
        private BigDecimal totalScore;
        private Boolean participatable;
        private Boolean submitted;
        private BigDecimal score;
        private Boolean studentView;
        private String examVersion;
    }

    // ==================== 考试结果 exam-results ====================

    /** 提交考试结果请求 */
    @Data
    public static class SubmitExamResultRequest {
        private String examUsageId;
        private Map<String, Object> answers;
        private String methodKey;
    }

    /** 考试结果评分请求 */
    @Data
    public static class GradeExamResultRequest {
        private Map<String, Object> scores;
        private String comment;
    }

    /** 考试结果条目（ExamResult） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExamResultDto {
        private String id;
        private String examUsageId;
        private String userId;
        private String studentName;
        private String className;
        private String grade;
        private String majorId;
        private String majorName;
        private BigDecimal score;
        private BigDecimal totalScore;
        private Boolean isPass;
        private Map<String, Object> answers;
        private String gradingStatus;
        private Map<String, Object> gradingScores;
        private String gradingComment;
        private String graderId;
        private OffsetDateTime gradedAt;
        private OffsetDateTime submitTime;
        private OffsetDateTime createdAt;
        private String version;
    }

    // ==================== 场景测评结果 results ====================

    /** 提交场景测评结果请求 */
    @Data
    public static class SubmitResultRequest {
        private String taskId;
        private String sceneId;
        private String methodKey;
        private String evaluateeId;
        private String evaluatorId;
        private String evaluatorType;
        private BigDecimal maxScore;
        private Map<String, Object> objectiveAnswers;
        private Map<String, Object> subjectiveContent;
        private Map<String, Object> drawnQuestions;
        private Map<String, Object> evalPointScores;
        private String expectedVersion;
    }

    /** 场景测评结果评分请求 */
    @Data
    public static class GradeResultRequest {
        private BigDecimal score;
        private String comment;
        private Map<String, Object> evalPointScores;
        private Map<String, Object> drawnQuestions;
        private Map<String, Object> subjectiveContent;
    }

    /** 批量评分项 */
    @Data
    public static class BatchGradeItem {
        private String id;
        private BigDecimal score;
        private String comment;
        private Map<String, Object> evalPointScores;
    }

    /** 批量评分请求 */
    @Data
    public static class BatchGradeRequest {
        private List<BatchGradeItem> items;
    }

    /** 场景测评结果条目（SceneEvaluationResult） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SceneEvaluationResultDto {
        private String id;
        private String taskId;
        private String sceneId;
        private String methodKey;
        private String evaluateeId;
        private String evaluatorId;
        private String evaluatorType;
        private String status;
        private BigDecimal totalScore;
        private BigDecimal maxScore;
        private Map<String, Object> evalPointScores;
        private Map<String, Object> objectiveAnswers;
        private Map<String, Object> subjectiveContent;
        private Map<String, Object> drawnQuestions;
        private String comment;
        private OffsetDateTime gradedAt;
        private String gradedBy;
        private String version;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ==================== 认证 certifications ====================

    /** 等级映射项（LevelMapping） */
    @Data
    public static class LevelMappingDto {
        private String level;
        private Double min;
        private Double max;
    }

    /** 创建/更新认证规则请求 */
    @Data
    public static class CreateCertificationRuleRequest {
        private String careerPositionId;
        private String ruleSource;
    }

    /** 认证规则条目（CertificationRule） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationRuleDto {
        private String id;
        private String careerPositionId;
        private String status;
        private String ruleSource;
        private List<LevelMappingDto> levelMapping;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 创建/更新认证能力项请求 */
    @Data
    public static class CreateCertificationItemRequest {
        private String name;
        private Integer sortOrder;
    }

    /** 认证能力项条目（CertificationAbilityItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationAbilityItemDto {
        private String id;
        private String ruleId;
        private String name;
        private Integer sortOrder;
    }

    /** 创建/更新认证能力点请求（CertificationPointPayload） */
    @Data
    public static class CreateCertificationPointRequest {
        private String abilityPointId;
        private String mappingType;
        private List<LevelMappingDto> customLevelMapping;
        private String requiredLevel;
        private BigDecimal weight;
    }

    /** 认证能力点条目（CertificationAbilityPoint） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationAbilityPointDto {
        private String id;
        private String itemId;
        private String abilityPointId;
        private String mappingType;
        private List<LevelMappingDto> customLevelMapping;
        private String requiredLevel;
        private BigDecimal weight;
    }

    /** 认证关联任务请求（CertificationTaskPayload） */
    @Data
    public static class CertificationTaskRequest {
        private String taskId;
        private BigDecimal maxScore;
        private BigDecimal weight;
    }

    /** 认证关联任务条目（CertificationRelatedTask） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationRelatedTaskDto {
        private String id;
        private String certPointId;
        private String taskId;
        private BigDecimal maxScore;
        private BigDecimal weight;
    }

    /** 完整规则点（CertificationFullPoint） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationFullPointDto {
        private String id;
        private String name;
        private String description;
        private String mappingType;
        private List<LevelMappingDto> customLevelMapping;
        private String requiredLevel;
        private BigDecimal weight;
        private List<CertificationRelatedTaskDto> tasks;
    }

    /** 完整规则项（CertificationFullItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationFullItemDto {
        private String id;
        private String name;
        private Integer sortOrder;
        private String abilityName;
        private List<CertificationFullPointDto> points;
    }

    /** GET /certifications/{id}/full 响应 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationFullRuleResponse {
        private CertificationRuleDto rule;
        private List<CertificationFullItemDto> items;
    }

    /** PUT /certifications/{id}/full 请求（CertificationFullRulePayload） */
    @Data
    public static class PutFullCertificationRuleRequest {
        private String careerPositionId;
        private String ruleSource;
        private List<LevelMappingDto> levelMapping;
        private List<PutFullCertificationItemRequest> items;
    }

    @Data
    public static class PutFullCertificationItemRequest {
        private String name;
        private Integer sortOrder;
        private List<PutFullCertificationPointRequest> points;
    }

    @Data
    public static class PutFullCertificationPointRequest {
        private String abilityPointId;
        private String mappingType;
        private List<LevelMappingDto> customLevelMapping;
        private String requiredLevel;
        private BigDecimal weight;
        private List<CertificationTaskRequest> tasks;
    }

    /** 状态请求（认证规则 status / 批次 status） */
    @Data
    public static class StatusRequest {
        private String status;
    }

    /** 岗位能力模型任务（CertificationModelTask） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationModelTaskDto {
        private String taskId;
        private String taskName;
        private String scenarioName;
        private String taskType;
        private BigDecimal weight;
    }

    /** 岗位能力模型能力点（CertificationModelPoint） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationModelPointDto {
        private String abilityPointId;
        private String name;
        private String description;
        private String requiredLevel;
        private String rubricDescription;
        private BigDecimal weight;
        private List<CertificationModelTaskDto> tasks;
        private List<LevelMappingDto> levelMapping;
    }

    /** 岗位能力模型能力域（CertificationModelDomain） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationModelDomainDto {
        private String name;
        private List<CertificationModelPointDto> points;
    }

    /** GET /certifications/positions/{positionId}/model 响应 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificationPositionModelDto {
        private RuleRefDto rule;
        private String positionId;
        private List<CertificationModelDomainDto> domains;
    }

    /** 模型响应中的规则引用（{id, status} 或 null） */
    @Data
    public static class RuleRefDto {
        private String id;
        private String status;
    }

    /** PUT /certifications/positions/{positionId}/weights 请求（CertificationWeightsPayload） */
    @Data
    public static class CertificationWeightsPayload {
        private List<CertificationPointWeightDto> pointWeights;
        private List<CertificationTaskWeightDto> taskWeights;
    }

    @Data
    public static class CertificationPointWeightDto {
        private String abilityPointId;
        private BigDecimal weight;
    }

    @Data
    public static class CertificationTaskWeightDto {
        private String abilityPointId;
        private String taskId;
        private BigDecimal weight;
    }

    /** PUT /certifications/positions/{positionId}/points/{abilityPointId}/levels 请求 */
    @Data
    public static class PutPointLevelsRequest {
        private List<LevelMappingDto> levelMapping;
    }

    /** PUT /certifications/positions/{positionId}/points/{abilityPointId}/task-weights 请求 */
    @Data
    public static class PutPointTaskWeightsRequest {
        private List<CertificationTaskWeightDto> taskWeights;
    }

    // ==================== 岗位能力结果 job-ability ====================

    /** 岗位能力结果条目（JobAbilityResultItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JobAbilityResultItemDto {
        private String id;
        private String positionId;
        private String positionName;
        private String userId;
        private String studentName;
        private String studentId;
        private String className;
        private String majorId;
        private String majorName;
        private String department;
        private Integer totalAbilityPoints;
        private Integer achievedAbilityPoints;
        private BigDecimal achievementRate;
        private String grade;
        private List<Object> abilityPointDetails;
        private List<Object> gradeHistory;
        private OffsetDateTime evaluationTime;
        private BigDecimal positionCompetency;
        private BigDecimal positionCompetencyV2;
        private BigDecimal abilityCognitionScore;
    }

    /** 岗位能力汇总条目（JobAbilitySummaryItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JobAbilitySummaryItemDto {
        private String positionId;
        private String positionName;
        private Integer studentCount;
        private BigDecimal avgRate;
    }

    /** 岗位能力汇聚请求 */
    @Data
    public static class JobAbilityAggregateRequest {
        private String careerPositionId;
        private List<String> userIds;
    }

    /** 汇聚日志（JobAbilityAggregateStatus / JobAbilityAggregateLog） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JobAbilityAggregateLogDto {
        private String id;
        private String careerPositionId;
        private String status;
        private Integer studentCount;
        private Integer updatedCount;
        private String errorMessage;
        private OffsetDateTime startedAt;
        private OffsetDateTime finishedAt;
    }

    // ==================== 学生画像/档案 portraits ====================

    /** 生成画像请求 */
    @Data
    public static class GeneratePortraitRequest {
        private String userId;
        private String careerPositionId;
    }

    /** 学生能力画像条目（StudentAbilityPortrait） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class StudentAbilityPortraitDto {
        private String id;
        private String userId;
        private String careerPositionId;
        private String overallGrade;
        private List<Object> domainScores;
        private Integer classRank;
        private Integer classTotal;
        private Integer majorRank;
        private Integer majorTotal;
        private Integer completedCourses;
        private Integer completedScenes;
        private BigDecimal totalCredits;
        private List<Object> courseRecords;
        private Boolean graduationQualified;
        private BigDecimal attendanceRate;
        private String diplomaBadge;
        private String dualBadge;
        private Integer archiveCount;
        private List<Object> recommendPositions;
        private OffsetDateTime updatedAt;
    }

    /** 创建学生档案请求 */
    @Data
    public static class CreateStudentArchiveRequest {
        private String userId;
        private String materialType;
        private String materialName;
        private String issuingOrg;
        private String obtainDate;
        private String direction;
    }

    /** 学生能力档案条目（StudentAbilityArchive） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class StudentAbilityArchiveDto {
        private String id;
        private String userId;
        private String materialType;
        private String materialName;
        private String issuingOrg;
        private String obtainDate;
        private String level;
        private String auditStatus;
        private String auditRemark;
        private BigDecimal convertedCredit;
        private String direction;
        private Boolean isEnabled;
        private OffsetDateTime createdAt;
    }

    // ==================== 评价批次 batches ====================

    /** 创建/更新评价批次请求 */
    @Data
    public static class BatchRequest {
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String workflowId;
        private String status;
    }

    /** 评价批次条目（EvaluationBatch） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EvaluationBatchDto {
        private String id;
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String majorName;
        private String workflowId;
        private String status;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ==================== 公共 ====================

    /** 邀请协作者请求（InviteRequest） */
    @Data
    public static class InviteRequest {
        private String userId;
    }

    /** 审核请求（ContentReviewRequest） */
    @Data
    public static class ReviewRequest {
        private String status;
        private String comment;
    }

    /** 删除响应 {id} */
    @Data
    public static class IdResponse {
        private String id;
    }

    /** 计数响应 {count} */
    @Data
    public static class CountResponse {
        private Integer count;
    }

    // ---------- 申诉 appeals ----------

    /** 申诉条目（对齐 Go domain.AppealRecord） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AppealDto {
        private String id;
        private String userId;
        private String type;
        private String reason;
        private String status;
        private java.time.OffsetDateTime createdAt;
    }

    /** 创建申诉请求（CreateAppealRequest） */
    @Data
    public static class CreateAppealRequest {
        private String userId;
        private String type;
        private String reason;
    }

    /** 处理申诉请求（ProcessAppealRequest） */
    @Data
    public static class ProcessAppealRequest {
        private String status;
        private String remark;
    }

    // ---------- 课程成绩 / 画像仪表盘 ----------

    /** 课程成绩项（对齐 Go CourseScoreItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CourseScoreItemDto {
        private String courseId;
        private String courseName;
        private Double score;
        private Integer rank;
        private Integer total;
    }

    /** 画像推荐岗位项（PortraitPositionItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PortraitPositionItem {
        private String positionId;
        private String positionName;
    }

    /** 画像课程成绩项（PortraitCourseItem，score/rank/total 可空） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PortraitCourseItem {
        private String courseId;
        private String courseName;
        private Double score;
        private Integer rank;
        private Integer total;
    }

    /** 学生画像仪表盘响应（StudentDashboardResponse） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class StudentDashboardDto {
        private Integer sceneCount;
        private List<PortraitPositionItem> positions;
        private List<PortraitCourseItem> courses;
    }
}
