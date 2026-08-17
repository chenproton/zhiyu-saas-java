package org.dromara.zhiyu.domain.dto.partner;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 企业平台（partner）请求/响应 DTO 集合（对齐 Go handler/service 的 JSON 形状，前端契约零改动）。
 *
 * @author zhiyu
 */
public final class PartnerDtos {

    private PartnerDtos() {
    }

    // ===== 企业主体 =====

    /** PUT /partner/enterprise/profile 更新请求（部分更新，未携带字段保留原值）。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ProfileUpdateRequest {
        private String name;
        private String industry;
        private String region;
        private String description;
        private String logoUrl;
        private String coverImage;
        private List<String> cooperationTypes;
        private String contactPerson;
        private String contactPhone;
        private String contactEmail;
        private String address;
        private String unifiedSocialCreditCode;
        private Integer establishedYear;
        private Integer employeeCount;
        private List<String> businessLicensePhotos;
        private List<String> qualificationPhotos;
        private List<String> intellectualPropertyPhotos;
        private List<String> coverPhotos;
        private Boolean enablePublic;
    }

    // ===== 专家 =====

    /** POST /partner/experts 创建请求：档案字段 + 自动生成账号（用户名+密码）。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExpertCreateRequest {
        private String name;
        private String gender;
        private Integer age;
        private String title;
        private String position;
        private String expertType;
        private String industry;
        private List<String> professionalFields;
        private List<String> specialties;
        private Integer experienceYears;
        private String education;
        private String introduction;
        private String workExperience;
        private String city;
        private String avatarUrl;
        private String coverImage;
        private List<String> photos;
        private List<String> attachments;
        private String organization;
        private String rating;
        private String status;
        private String partnerSource;
        private String positionDirection;
        private List<String> secondaryColleges;
        private Boolean isPublic;
        private String username;
        private String password;
    }

    /** PUT /partner/experts/{id}、/partner/experts/me 更新请求（部分更新，isPublic 用 Boolean 区分未携带）。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExpertUpdateRequest {
        private String name;
        private String gender;
        private Integer age;
        private String title;
        private String position;
        private String expertType;
        private String industry;
        private List<String> professionalFields;
        private List<String> specialties;
        private Integer experienceYears;
        private String education;
        private String introduction;
        private String workExperience;
        private String city;
        private String avatarUrl;
        private String coverImage;
        private List<String> photos;
        private List<String> attachments;
        private String organization;
        private String rating;
        private String status;
        private String partnerSource;
        private String positionDirection;
        private List<String> secondaryColleges;
        private Boolean isPublic;
        private String userId;
        private String password;
    }

    /** POST /partner/experts 创建响应。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExpertCreateResponse {
        private Object expert;
        private String username;
        private String initialPassword;
    }

    // ===== 密码 / 学校状态 =====

    /** PUT /partner/me/password 请求。 */
    @Data
    public static class ChangePasswordRequest {
        private String oldPassword;
        private String newPassword;
    }

    /** PUT /partner/schools/{tenantId}/status 请求。 */
    @Data
    public static class SchoolStatusRequest {
        private String status;
    }

    // ===== 工作台统计 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MonthCount {
        private String month;
        private int count;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class NewMonthCount {
        private String month;
        private int experts;
        private int positions;
        private int scenarios;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ContentMonthCount {
        private String month;
        private int projects;
        private int agreements;
        private int achievements;
    }

    /** GET /partner/workspace/dashboard 响应。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Dashboard {
        private int expertCount;
        private int schoolCount;
        private int memberCount;
        private int publicExpertCount;
        private int coBuildPositionCount;
        private int coBuildScenarioCount;
        private List<MonthCount> monthlySchoolCounts;
        private List<NewMonthCount> monthlyNewCounts;
        private List<ContentMonthCount> contentMonthlyCounts;
    }

    // ===== 合作学校 =====

    /** GET /partner/schools 列表项（link 反向视图）。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class School {
        private String linkId;
        private String tenantId;
        private String schoolName;
        private String relationType;
        private String status;
        private String rating;
        private String enterpriseType;
        private Boolean isPublic;
        private OffsetDateTime createdAt;
    }

    // ===== 合作内容 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CooperationProject {
        private String id;
        private String name;
        private String phase;
        private Boolean isPublic;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CooperationAchievement {
        private String id;
        private String title;
        private String type;
        private Boolean isPublic;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CooperationAgreement {
        private String id;
        private String name;
        private String type;
        private String status;
        private Boolean isPublic;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CooperationSchool {
        private String tenantId;
        private String schoolName;
        private List<CooperationProject> projects;
        private List<CooperationAchievement> achievements;
        private List<CooperationAgreement> agreements;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Milestone {
        private String id;
        private String name;
        private String description;
        private String dueDate;
        private String completedDate;
        private Boolean isCompleted;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CooperationProjectDetail {
        private String id;
        private String name;
        private String type;
        private String description;
        private String phase;
        private String publishStatus;
        private String startDate;
        private String endDate;
        private String budget;
        private List<String> secondaryColleges;
        private Boolean isPublic;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private List<Milestone> milestones;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CooperationAchievementDetail {
        private String id;
        private String title;
        private String type;
        private String description;
        private String achievementDate;
        private String citationReason;
        private List<String> ownerPersons;
        private List<String> coBuilders;
        private List<String> secondaryColleges;
        private String status;
        private int viewCount;
        private Boolean isPublic;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CooperationAgreementDetail {
        private String id;
        private String name;
        private String type;
        private String content;
        private String startDate;
        private String endDate;
        private String status;
        private Boolean isPublic;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ===== 专家测评任务 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MentorTask {
        private String taskId;
        private String taskName;
        private String stepLabel;
        private String schoolName;
        private String expertName;
        private int assignedCount;
        private int gradedCount;
        private OffsetDateTime updatedAt;
    }

    // ===== 共建人候选 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CoBuildUserOption {
        private String id;
        private String name;
        private String group;
        private String title;
        private String expertId;
        private String enterpriseName;
    }

    // ===== 就业岗位 =====

    /** POST/PUT /partner/employment-jobs 请求（Partial&lt;EmploymentJob&gt; & {schoolTenantId}）。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JobRequest {
        private String schoolTenantId;
        private String projectId;
        private String title;
        private String jobType;
        private String location;
        private BigDecimal salaryMin;
        private BigDecimal salaryMax;
        private Integer headcount;
        private String education;
        private List<String> suitableMajors;
        private String description;
        private String responsibilities;
        private String requirements;
        private String contactPerson;
        private String contactPhone;
        private java.time.LocalDate deadline;
    }

    /** POST /partner/employment-jobs/{id}/status 请求。 */
    @Data
    public static class JobStatusRequest {
        private String action;
        private String projectId;
    }

    // ===== 共建岗位/场景 =====

    /** POST /partner/co-build/positions 创建请求。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PositionCreateRequest {
        private String schoolTenantId;
        private String name;
        private String positionType;
        private String batchId;
        private String shortName;
        private String industryId;
        private Integer salaryMin;
        private Integer salaryMax;
        private String coverImage;
        private String description;
        private List<String> requirements;
        private String careerPath;
        private String version;
        private List<String> collaborators;
        private List<String> majorIds;
    }

    /** POST /partner/co-build/scenes 创建请求。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ScenarioCreateRequest {
        private String schoolTenantId;
        private String name;
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

    /** POST/PUT 场景任务请求（对齐 portal CreateScenarioTaskRequest）。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TaskRequest {
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

    /** POST /partner/co-build/scenes/{id}/tasks/reorder 请求。 */
    @Data
    public static class ReorderRequest {
        private List<String> taskIds;
    }

    // ===== 任务权重 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WeightItem {
        private String taskId;
        private BigDecimal weight;
    }

    /** PUT /partner/co-build/scenes/{id}/weights 请求。 */
    @Data
    public static class SaveWeightsRequest {
        private List<WeightItem> weights;
    }

    // ===== 任务测评方式 =====

    /** GET/PUT /partner/co-build/tasks/{taskId}/evaluation-methods 响应。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EvaluationMethodsResponse {
        private List<TaskEvaluationMethodDto> methods;
    }

    /** PUT /partner/co-build/tasks/{taskId}/evaluation-methods 请求（对齐 portal SaveTaskEvaluationMethodsRequest）。 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SaveEvaluationMethodsRequest {
        private Integer version;
        private List<MethodInput> methods;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MethodInput {
        private String methodKey;
        private BigDecimal weight;
        private String evalObject;
        private String scoreType;
        private List<Object> evalSubjects;
        private String standardName;
        private String standardMode;
        private Object resourceConfig;
        private Boolean isEnabled;
        private List<EvalPointInput> evalPoints;
        private List<ScoreRuleInput> scoreRules;
        private List<ReviewStepInput> reviewSteps;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EvalPointInput {
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

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ScoreRuleInput {
        private String name;
        private String description;
        private String rule;
        private BigDecimal weight;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ReviewStepInput {
        private String label;
        private String description;
        private Boolean enabled;
        private String subjectType;
        private List<String> assignedUserIds;
        private BigDecimal weight;
        private Integer sortOrder;
    }

    // ===== 完整保存岗位（save-full） =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SaveFullPositionRequest {
        private String batchId;
        private String name;
        private String shortName;
        private String industry;
        private List<String> majors;
        private String positionType;
        private List<Integer> salaryRange;
        private String coverImage;
        private String description;
        private List<String> requirements;
        private String careerPath;
        private String version;
        private List<String> collaborators;
        private List<ResponsibilityItem> responsibilities;
        private List<CertificateItem> certificates;
        private List<AbilityBindingItem> abilityBindings;
        private List<AbilityDomainItem> abilityDomains;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ResponsibilityItem {
        private String id;
        private String name;
        private String description;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificateItem {
        private String id;
        private String name;
        private String url;
        private String description;
        private String image;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AbilityBindingItem {
        private String id;
        private String responsibilityId;
        private String source;
        private String publicAbilityId;
        private String abilityPointId;
        private String name;
        private String level;
        private String rubricDescription;
        private String description;
        private List<String> attributes;
        private String domain;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AbilityDomainItem {
        private String id;
        private String name;
        private String description;
        private List<String> bindingIds;
    }
}
