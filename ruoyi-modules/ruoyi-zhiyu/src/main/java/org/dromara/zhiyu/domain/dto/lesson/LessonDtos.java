package org.dromara.zhiyu.domain.dto.lesson;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * lesson 域 DTO（对齐 Go lesson 相关 handler 与 shared-types lesson.ts）。
 *
 * @author zhiyu
 */
public class LessonDtos {

    // ---------- 课程 courses ----------

    /** 课程条目（Course，对齐 Go domain.Course） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CourseDto {
        private String id;
        private String code;
        private String name;
        private String type;
        private String category;
        private String majorId;
        private String majorName;
        private String teacherId;
        private String industryId;
        private String industryName;
        private String version;
        private BigDecimal onlineHours;
        private BigDecimal offlineHours;
        private BigDecimal onlineWeight;
        private BigDecimal offlineWeight;
        private String semester;
        private String className;
        private String status;
        private String coverColor;
        private String coverImage;
        private String courseTag;
        private Integer difficulty;
        private String description;
        private List<String> knowledgePointIds;
        private List<String> knowledgePointNames;
        private List<String> abilityPointIds;
        private List<String> resourceIds;
        private String creatorId;
        private String creatorName;
        private List<String> coCreatorIds;
        private String batchId;
        private String batchName;
        private Map<String, Object> evalData;
        private Integer nodeCount;
        private Integer resourceCount;
        private Integer studyCount;
        private Integer viewCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 创建课程请求（Omit id/nodeCount/resourceCount/studyCount/createdAt/updatedAt） */
    @Data
    public static class CreateCourseRequest {
        private String code;
        private String name;
        private String type;
        private String category;
        private String majorId;
        private String teacherId;
        private String industryId;
        private String version;
        private BigDecimal onlineHours;
        private BigDecimal offlineHours;
        private BigDecimal onlineWeight;
        private BigDecimal offlineWeight;
        private String semester;
        private String className;
        private String coverColor;
        private String coverImage;
        private String courseTag;
        private Integer difficulty;
        private String description;
        private List<String> knowledgePointIds;
        private List<String> abilityPointIds;
        private List<String> resourceIds;
        private List<String> coCreatorIds;
        private String batchId;
        private Map<String, Object> evalData;
    }

    /** 更新课程请求（部分更新：null 字段保留原值） */
    @Data
    public static class UpdateCourseRequest {
        private String code;
        private String name;
        private String type;
        private String category;
        private String majorId;
        private String teacherId;
        private String industryId;
        private String version;
        private BigDecimal onlineHours;
        private BigDecimal offlineHours;
        private BigDecimal onlineWeight;
        private BigDecimal offlineWeight;
        private String semester;
        private String className;
        private String coverColor;
        private String coverImage;
        private String courseTag;
        private Integer difficulty;
        private String description;
        private List<String> knowledgePointIds;
        private List<String> abilityPointIds;
        private List<String> resourceIds;
        private List<String> coCreatorIds;
        private String batchId;
        private Map<String, Object> evalData;
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

    /** 克隆课程请求（CloneCourseRequest） */
    @Data
    public static class CloneCourseRequest {
        private String name;
    }

    // ---------- 知识点 knowledge-points ----------

    /** 知识点条目（KnowledgePoint） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class KnowledgePointDto {
        private String id;
        private String name;
        private String code;
        private String description;
        private String category;
        private Boolean linked;
        private List<String> granularLessonIds;
        private String creatorId;
        private String sourceType;
        private String sourceId;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 知识点创建/更新请求（更新时忽略 sourceType/sourceId） */
    @Data
    public static class KnowledgePointRequest {
        private String name;
        private String code;
        private String description;
        private Boolean linked;
        private List<String> granularLessonIds;
        private String sourceType;
        private String sourceId;
    }

    // ---------- 课程节点 nodes ----------

    /** 课程节点条目（对齐 Go SystemCourseNodeResponse：order/type/knowledgePoints/resources） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SystemCourseNodeDto {
        private String id;
        private String courseId;
        private String parentId;
        private String name;
        private String code;
        private Integer order;
        private String type;
        private String sourceId;
        private String sourceName;
        private String teachingGoals;
        private String detailedDescription;
        private String descriptionPdf;
        private String background;
        private BigDecimal estimatedHours;
        private Integer duration;
        private Integer difficulty;
        private Map<String, Object> evalData;
        private String status;
        private List<NodeKnowledgePointDto> knowledgePoints;
        private List<NodeEnrichResourceDto> resources;
        private List<NodeQuizDto> quizzes;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 节点知识点（enrich 用，对齐 Go SystemCourseNodeKnowledgePoint） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class NodeKnowledgePointDto {
        private String id;
        private String name;
        private String code;
        private String description;
        private Boolean linked;
    }

    /** 节点资源（enrich 用，对齐 Go SystemCourseNodeResource） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class NodeEnrichResourceDto {
        private String id;
        private String name;
        private String type;
        private String url;
        private Integer size;
    }

    /** 节点测验（对齐 Go domain.NodeQuiz） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class NodeQuizDto {
        private String id;
        private String nodeId;
        private String title;
        private String type;
        private Integer timeLimit;
    }

    /** 创建/更新节点请求（CreateCourseNodeRequest） */
    @Data
    public static class CreateNodeRequest {
        private String courseId;
        private String parentId;
        private String name;
        private String code;
        private Integer sortOrder;
        private String refType;
        private String sourceId;
        private String sourceName;
        private String teachingGoals;
        private String detailedDescription;
        private String descriptionPdf;
        private String background;
        private BigDecimal estimatedHours;
        private Integer duration;
        private Integer difficulty;
        private List<String> knowledgePointIds;
        private List<String> resourceIds;
        private Map<String, Object> evalData;
        private String status;
    }

    /** 节点重排请求（ReorderCourseNodesRequest） */
    @Data
    public static class ReorderNodesRequest {
        private String courseId;
        private List<String> nodeIds;
    }

    // ---------- 节点/课程资源 ----------

    /** 节点/课程资源条目（NodeResource，对齐 Go domain.NodeResource） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class NodeResourceDto {
        private String id;
        private String nodeId;
        private String name;
        private String type;
        private String url;
        private Integer size;
        private String description;
        private String uploadedBy;
        private OffsetDateTime uploadedAt;
    }

    /** 创建节点资源请求（CreateNodeResourceRequest） */
    @Data
    public static class CreateNodeResourceRequest {
        private String nodeId;
        private String name;
        private String type;
        private String url;
        private String description;
        private Integer size;
    }

    /** 绑定节点资源请求（BindNodeResourceRequest） */
    @Data
    public static class BindNodeResourceRequest {
        private String nodeId;
        private String resourceId;
    }

    /** 创建课程资源请求（CreateCourseResourceRequest） */
    @Data
    public static class CreateCourseResourceRequest {
        private String courseId;
        private String name;
        private String type;
        private String url;
        private String description;
        private Integer size;
    }

    /** 绑定课程资源请求（BindCourseResourceRequest） */
    @Data
    public static class BindCourseResourceRequest {
        private String courseId;
        private String resourceId;
    }

    // ---------- 混合模块 hybrid-modules ----------

    /** 混合模块条目（HybridNodeModule） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class HybridNodeModuleDto {
        private String id;
        private String nodeId;
        private String moduleKey;
        private String mode;
        private Map<String, Object> data;
    }

    /** 批量保存混合模块请求（BatchSaveHybridModulesRequest） */
    @Data
    public static class BatchSaveHybridModulesRequest {
        private String nodeId;
        private List<HybridModulePayload> modules;
    }

    /** 混合模块载荷（UpsertHybridModuleRequestPart） */
    @Data
    public static class HybridModulePayload {
        private String moduleKey;
        private String mode;
        private Map<String, Object> data;
    }

    // ---------- 课程批次 batches ----------

    /** 课程批次条目（LessonBatch） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class LessonBatchDto {
        private String id;
        private String tenantId;
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String majorName;
        private String workflowId;
        private String status;
        private Integer courseCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

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

    // ---------- 节点测评结果 node-evaluation-results ----------

    /** 节点测评结果条目（NodeEvaluationResult） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class NodeEvaluationResultDto {
        private String id;
        private String nodeId;
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
    }

    /** 节点测评结果评分请求（GradeNodeResultRequest） */
    @Data
    public static class GradeNodeResultRequest {
        private BigDecimal score;
        private String comment;
        private Map<String, Object> evalPointScores;
    }

    /** 提交节点测评结果请求（SubmitResultRequest） */
    @Data
    public static class SubmitNodeEvaluationResultRequest {
        private String nodeId;
        private String expectedVersion;
        private String methodKey;
        private String evaluateeId;
        private String evaluatorId;
        private String evaluatorType;
        private BigDecimal maxScore;
        private Map<String, Object> evalPointScores;
        private Map<String, Object> objectiveAnswers;
        private Map<String, Object> subjectiveContent;
        private Map<String, Object> drawnQuestions;
    }

    // ---------- 节点测验 quizzes ----------

    /** 创建测验请求（CreateNodeQuizRequest） */
    @Data
    public static class CreateQuizRequest {
        private String nodeId;
        private String title;
        private String type;
        private Integer timeLimit;
    }

    /** 更新测验请求（UpdateNodeQuizRequest） */
    @Data
    public static class UpdateQuizRequest {
        private String title;
        private String type;
        private Integer timeLimit;
    }

    /** 测验题目条目（对齐 Go domain.NodeQuizQuestion） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class NodeQuizQuestionDto {
        private String id;
        private String quizId;
        private String type;
        private String question;
        private Map<String, Object> options;
        private String answer;
        private java.math.BigDecimal score;
        private Integer sortOrder;
    }

    /** 测验题目创建/更新请求（CreateNodeQuizQuestionRequest） */
    @Data
    public static class QuizQuestionRequest {
        private String type;
        private String question;
        private Map<String, Object> options;
        private String answer;
        private java.math.BigDecimal score;
        private Integer sortOrder;
    }

    // ---------- 课堂行为 behavior-collection ----------

    /** 行为记录条目（对齐 Go domain.LessonBehaviorRecord） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BehaviorRecordDto {
        private String id;
        private String courseId;
        private String studentUserId;
        private String studentName;
        private String recordDate;
        private String attendance;
        private java.math.BigDecimal quizScore;
        private Integer interactionCount;
        private Integer praiseCount;
        private Integer rushCorrectCount;
        private Integer rushAvgTimeSec;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 保存行为记录请求（CreateLessonBehaviorRequest） */
    @Data
    public static class CreateBehaviorRecordRequest {
        private String courseId;
        private String studentUserId;
        private String recordDate;
        private String attendance;
        private java.math.BigDecimal quizScore;
        private Integer interactionCount;
        private Integer praiseCount;
        private Integer rushCorrectCount;
        private Integer rushAvgTimeSec;
    }

    /** 课堂行为聚合响应（对齐 Go LessonBehaviorAggregate） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BehaviorAggregateDto {
        private SignInSummaryDto signIn;
        private List<DailySignInDto> signInDaily;
        private List<QuizResultDto> quizResults;
        private List<RushRankDto> rushAnswerRanking;
        private List<InteractionItemDto> classInteraction;
        private List<RateItemDto> attendanceRateData;
        private List<StudentBehaviorRowDto> studentDetails;
    }

    /** 签到汇总（SignInSummary） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SignInSummaryDto {
        private Integer total;
        private Integer present;
        private Integer late;
        private Integer absent;
        private Integer rate;
    }

    /** 每日签到（DailySignIn） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DailySignInDto {
        private String date;
        private Integer present;
        private Integer late;
        private Integer absent;
    }

    /** 测验结果（QuizResult） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QuizResultDto {
        private String id;
        private String name;
        private Integer avgScore;
        private Integer passRate;
        private Integer count;
    }

    /** 抢答排名（RushRank） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RushRankDto {
        private Integer rank;
        private String name;
        private Integer correctCount;
        private String avgTime;
        private String badge;
    }

    /** 课堂互动项（InteractionItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class InteractionItemDto {
        private String name;
        private Integer active;
        private Integer total;
    }

    /** 出勤率项（RateItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RateItemDto {
        private String name;
        private Integer rate;
    }

    /** 学生行为行（StudentBehaviorRow） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class StudentBehaviorRowDto {
        private String name;
        private Integer attendance;
        private Integer quizAvg;
        private Integer interaction;
        private Integer praise;
    }

    // ---------- 混合模块写操作 hybrid-modules ----------

    /** 混合模块 upsert 请求（UpsertHybridModuleRequest） */
    @Data
    public static class UpsertHybridModuleRequest {
        private String id;
        private String nodeId;
        private String moduleKey;
        private String mode;
        private Map<String, Object> data;
    }
}
