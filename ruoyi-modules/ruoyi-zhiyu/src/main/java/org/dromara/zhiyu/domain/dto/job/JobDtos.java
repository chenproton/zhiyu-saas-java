package org.dromara.zhiyu.domain.dto.job;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 岗位职业 job 域 DTO（对齐 Go job 相关 handler 与 shared-types job.ts / job-source.ts）。
 *
 * @author zhiyu
 */
public class JobDtos {

    // ---------- 岗位 career_positions ----------

    /** 创建岗位请求（CreatePositionRequest；字段与更新一致） */
    @Data
    public static class PositionCreateRequest {
        private String batchId;
        private String name;
        private String shortName;
        private String industryId;
        private String positionType;
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

    /** 更新岗位请求（Partial，null 字段保留原值，对齐 Go UpdatePositionRequest 合并语义） */
    @Data
    public static class PositionUpdateRequest {
        private String batchId;
        private String name;
        private String shortName;
        private String industryId;
        private String positionType;
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

    /** 岗位条目（CareerPosition，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CareerPositionDto {
        private String id;
        private String code;
        private String batchId;
        private String name;
        private String shortName;
        private String industryId;
        private List<String> majorIds;
        private List<String> majorNames;
        private String positionType;
        private Integer salaryMin;
        private Integer salaryMax;
        private String coverImage;
        private String description;
        private List<String> requirements;
        private String careerPath;
        private String version;
        private String status;
        private String sourceType;
        private String sourceEnterpriseId;
        private String createdBy;
        private String createdByName;
        private List<String> collaborators;
        private List<String> collaboratorNames;
        private Integer favoriteCount;
        private Integer viewCount;
        private Integer abilityCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    /** 岗位完整保存请求（SaveFullPositionRequest，岗位构建器保存用） */
    @Data
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
        private List<FullPositionResponsibility> responsibilities;
        private List<FullPositionCertificate> certificates;
        private List<FullPositionAbilityBinding> abilityBindings;
        private List<FullPositionAbilityDomain> abilityDomains;
    }

    /** SaveFull 职责项 */
    @Data
    public static class FullPositionResponsibility {
        private String id;
        private String name;
        private String description;
    }

    /** SaveFull 证书项 */
    @Data
    public static class FullPositionCertificate {
        private String id;
        private String name;
        private String url;
        private String description;
        private String image;
    }

    /** SaveFull 能力绑定项 */
    @Data
    public static class FullPositionAbilityBinding {
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

    /** SaveFull 能力域项 */
    @Data
    public static class FullPositionAbilityDomain {
        private String id;
        private String name;
        private String description;
        private List<String> bindingIds;
    }

    // ---------- 内容工作流公共请求（对齐 content_actions.go） ----------

    /** 审核请求（ContentReviewRequest） */
    @Data
    public static class ContentReviewRequest {
        private String status;
        private String comment;
    }

    /** 邀请协作者请求（InviteRequest） */
    @Data
    public static class InviteRequest {
        private String userId;
    }

    /** 克隆岗位请求（ClonePositionRequest） */
    @Data
    public static class CloneRequest {
        private String name;
    }

    // ---------- 能力点 ability_points ----------

    /** 能力点创建/更新请求（AbilityRequest） */
    @Data
    public static class AbilityRequest {
        private String name;
        private String description;
        private List<String> attributes;
        private Boolean isPublic;
    }

    /** 能力点条目（AbilityPoint，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AbilityPointDto {
        private String id;
        private String name;
        private String code;
        private String description;
        private List<String> attributes;
        private Boolean isPublic;
        private String creatorId;
        private OffsetDateTime createdAt;
    }

    // ---------- 岗位-能力绑定 position_ability_bindings ----------

    /** 能力绑定创建/更新请求（CreatePositionAbilityRequest） */
    @Data
    public static class PositionAbilityRequest {
        private String careerPositionId;
        private String responsibilityId;
        private String abilityPointId;
        private String source;
        private String domain;
        private String requiredLevel;
        private String rubricDescription;
        private List<String> attributes;
        private BigDecimal weight;
    }

    /** 能力绑定条目（PositionAbilityBinding，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PositionAbilityBindingDto {
        private String id;
        private String careerPositionId;
        private String responsibilityId;
        private String abilityPointId;
        private String abilityName;
        private String source;
        private String domain;
        private String requiredLevel;
        private String rubricDescription;
        private List<String> attributes;
        private BigDecimal weight;
    }

    // ---------- 能力域 ability_domains ----------

    /** 能力域创建/更新请求（AbilityDomainRequest） */
    @Data
    public static class AbilityDomainRequest {
        private String careerPositionId;
        private String name;
        private String description;
        private List<String> bindingIds;
        private Integer sortOrder;
    }

    /** 能力域条目（AbilityDomain，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AbilityDomainDto {
        private String id;
        private String careerPositionId;
        private String name;
        private String description;
        private List<String> bindingIds;
        private Integer sortOrder;
    }

    // ---------- 岗位职责 position_responsibilities ----------

    /** 岗位职责创建/更新请求（PositionResponsibilityRequest） */
    @Data
    public static class PositionResponsibilityRequest {
        private String careerPositionId;
        private String name;
        private String description;
        private Integer sortOrder;
    }

    /** 岗位职责条目（PositionResponsibility，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PositionResponsibilityDto {
        private String id;
        private String careerPositionId;
        private String name;
        private String description;
        private Integer sortOrder;
    }

    // ---------- 岗位证书 position_certificates ----------

    /** 岗位证书创建/更新请求（PositionCertificateRequest） */
    @Data
    public static class PositionCertificateRequest {
        private String careerPositionId;
        private String name;
        private String url;
        private String description;
        private String imageUrl;
    }

    /** 岗位证书条目（PositionCertificate，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PositionCertificateDto {
        private String id;
        private String careerPositionId;
        private String certificateLibraryId;
        private String name;
        private String url;
        private String description;
        private String imageUrl;
    }

    // ---------- 证书库 certificate_library ----------

    /** 证书库创建/更新请求（CertificateLibraryRequest，字段均为可选） */
    @Data
    public static class CertificateLibraryRequest {
        private String name;
        private String url;
        private String description;
        private String imageUrl;
    }

    /** 证书库条目（CertificateLibraryItem，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CertificateLibraryItemDto {
        private String id;
        private String tenantId;
        private String name;
        private String url;
        private String description;
        private String imageUrl;
        private String creatorId;
        private OffsetDateTime createdAt;
    }

    // ---------- 岗位批次 batches ----------

    /** 批次创建请求（BatchCreateRequest） */
    @Data
    public static class BatchCreateRequest {
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String workflowId;
        private String status;
    }

    /** 批次更新请求（BatchUpdateRequest） */
    @Data
    public static class BatchUpdateRequest {
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String workflowId;
        private String status;
    }

    /** 批次状态更新请求（BatchUpdateStatusRequest） */
    @Data
    public static class BatchStatusRequest {
        private String status;
    }

    /** 批次条目（JobBatch，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JobBatchDto {
        private String id;
        private String tenantId;
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String majorName;
        private String workflowId;
        private String status;
        private Integer positionCount;
        private Integer publishedCount;
        private Integer pendingCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ---------- 岗位推荐 position_recommendations ----------

    /** 推荐创建/更新请求（RecommendRequest，字段一致） */
    @Data
    public static class RecommendRequest {
        private String majorId;
        private String careerPositionId;
        private String positionType;
        private String reason;
        private Integer sortOrder;
        private Boolean isEnabled;
    }

    /** 推荐条目（PositionRecommendation，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PositionRecommendationDto {
        private String id;
        private String majorId;
        private String majorName;
        private String careerPositionId;
        private String positionType;
        private String reason;
        private Integer sortOrder;
        private Boolean isEnabled;
        private String createdBy;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ---------- 学习路径 learn_roads ----------

    /** 学习路径创建/更新请求（CreateLearnRoadRequest） */
    @Data
    public static class LearnRoadRequest {
        private String name;
        private String description;
        private List<String> positionIds;
        private List<Object> steps;
    }

    /** 学习路径条目（LearnRoad，对齐 shared-types job.ts；steps 为步骤对象数组） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class LearnRoadDto {
        private String id;
        private String name;
        private String description;
        private List<String> positionIds;
        private List<Object> steps;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ---------- 审批流程 workflows ----------

    /** 审批流程创建/更新请求（WorkflowRequest） */
    @Data
    public static class WorkflowRequest {
        private String name;
        private String scene;
        private String description;
        private List<Object> steps;
        private List<String> majorIds;
        private String status;
    }

    /** 审批流程条目（Workflow，对齐 shared-types job-source.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkflowDto {
        private String id;
        private String tenantId;
        private String name;
        private String scene;
        private String description;
        private List<Object> steps;
        private List<String> majorIds;
        private Integer usageCount;
        private String status;
        private OffsetDateTime createdAt;
    }

    // ---------- 审批记录 approval_records ----------

    /** 创建审批请求（CreateApprovalRequest） */
    @Data
    public static class ApprovalCreateRequest {
        private String targetType;
        private String targetId;
        private String workflowId;
    }

    /** 评审审批请求（ReviewApprovalRequest） */
    @Data
    public static class ApprovalReviewRequest {
        private String action;
        private String remark;
    }

    /** 审批记录条目（ApprovalRecord；history 为评审历史对象数组） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ApprovalRecordDto {
        private String id;
        private String tenantId;
        private String targetType;
        private String targetId;
        private String workflowId;
        private Integer currentStepIdx;
        private String status;
        private String submitterId;
        private List<Object> history;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ---------- 岗位轮播图 banner_configs ----------

    /** 轮播图创建/更新请求（JobBannerRequest） */
    @Data
    public static class BannerRequest {
        private String title;
        private String imageUrl;
        private String linkUrl;
        private Integer sortOrder;
        private Boolean isEnabled;
    }

    /** 轮播图条目（BannerConfig，对齐 shared-types job.ts） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JobBannerConfigDto {
        private String id;
        private String title;
        private String imageUrl;
        private String linkUrl;
        private Integer sortOrder;
        private Boolean isEnabled;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ---------- 引用统计 / 收藏 ----------

    /** 引用次数分桶（CitationBucket） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CitationBucketDto {
        private String label;
        private Integer count;
    }

    /** 引用次数分布统计（CitationStats） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CitationStatsDto {
        private List<CitationBucketDto> buckets;
        private Integer zeroCount;
        private Integer total;
    }

    /** 零引用条目（UncitedItem） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UncitedItemDto {
        private String id;
        private String name;
        private OffsetDateTime createdAt;
    }

    /** 收藏状态响应（FavoriteStatusResponse） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FavoriteStatusDto {
        private Boolean isFavorite;
        private Integer favoriteCount;
    }
}
