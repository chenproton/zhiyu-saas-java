package org.dromara.zhiyu.domain.dto.alliance;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 联盟 alliance 域 DTO（对齐 Go domain/alliance.go 与 shared-types alliance.ts）。
 *
 * <p>jsonb 对象/数组字段使用类型化字段（Object/List/Map），由 Service 负责与实体
 * 的 JSON 原文字段互转。</p>
 *
 * @author zhiyu
 */
public final class AllianceDtos {

    private AllianceDtos() {
    }

    // ===== 学校信息 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SchoolInfoDto {
        private String id;
        private String tenantId;
        private String name;
        private String shortName;
        private String schoolType;
        private String province;
        private String city;
        private String address;
        private String website;
        private String contactPhone;
        private String description;
        private String logoUrl;
        private Object scaleData;
        private List<Map<String, Object>> secondaryColleges;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ===== 企业（link 合并视图） =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EnterpriseDto {
        private String id;
        private String tenantId;
        private String name;
        private String enterpriseType;
        private String industry;
        private String region;
        private String description;
        private String logoUrl;
        private String coverImage;
        private String status;
        private String rating;
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
        private List<String> secondaryColleges;
        private Object ratingRecord;
        private Boolean isPublic;
        private Boolean enablePublic;
        private Integer projectCount;
        private Integer agreementCount;
        private Integer achievementCount;
        private String linkId;
        private String relationType;
        private String createdBy;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EnterpriseRegisterRequest {
        private String enterpriseName;
        private String username;
        private String password;
        private String unifiedSocialCreditCode;
        private String contactPerson;
        private String contactPhone;
        private String contactEmail;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EnterpriseLinkRequest {
        private String relationType;
        private String enterpriseType;
        private String status;
        private String rating;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EnterpriseLinkUpdateRequest {
        private String rating;
        private String status;
        private String enterpriseType;
        private Boolean isPublic;
        private List<String> secondaryColleges;
    }

    // ===== 资源授权 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ResourceGrantDto {
        private String id;
        private String tenantId;
        private String enterpriseId;
        private String resourceType;
        private List<String> resourceIds;
        private String createdBy;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class GrantResourceOptionDto {
        private String id;
        private String name;
        private String type;
        private String source;
        private String sourceEnterpriseId;
        private String sourceEnterpriseName;
        private String status;
        private String batchId;
        private String batchName;
        private String schoolName;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SaveGrantsRequest {
        private String enterpriseId;
        private String resourceType;
        private List<String> resourceIds;
    }

    // ===== 项目 / 里程碑 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ProjectDto {
        private String id;
        private String tenantId;
        private String name;
        private String type;
        private String description;
        private String phase;
        private String publishStatus;
        private LocalDate startDate;
        private LocalDate endDate;
        private String budget;
        private String coverImage;
        private List<String> enterpriseIds;
        private List<String> agreementIds;
        private List<String> secondaryColleges;
        private Boolean isPublic;
        private Integer progress;
        private String createdBy;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MilestoneDto {
        private String id;
        private String tenantId;
        private String projectId;
        private String name;
        private String description;
        private LocalDate dueDate;
        private LocalDate completedDate;
        private Boolean isCompleted;
        private Integer sortOrder;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ===== 成果 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RelatedRef {
        private String id;
        private String name;
        private String code;
        private String coverImage;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AchievementDto {
        private String id;
        private String tenantId;
        private String title;
        private String type;
        private String description;
        private LocalDate achievementDate;
        private String coverImage;
        private List<String> attachments;
        private String citationReason;
        private List<String> images;
        private List<String> ownerPersons;
        private List<String> coBuilders;
        private List<String> enterpriseIds;
        private List<String> projectIds;
        private List<RelatedRef> relatedPositions;
        private List<RelatedRef> relatedScenes;
        private List<RelatedRef> relatedCourses;
        private String status;
        private Integer viewCount;
        private List<String> secondaryColleges;
        private Boolean isPublic;
        private String createdBy;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ===== 专家 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ExpertDto {
        private String id;
        private String tenantId;
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
        private String partnerSource;
        private String positionDirection;
        private List<String> photos;
        private List<String> attachments;
        private String enterpriseId;
        private String enterpriseName;
        private String organization;
        private String userId;
        private String rating;
        private String status;
        private List<String> secondaryColleges;
        private Boolean isPublic;
        private String createdBy;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MentorOptionDto {
        private String expertId;
        private String name;
        private String title;
        private String enterpriseId;
        private String enterpriseName;
        private String userId;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DisplayToggleRequest {
        private Boolean isPublic;
    }

    // ===== 协议 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AgreementDto {
        private String id;
        private String tenantId;
        private String name;
        private String type;
        private String content;
        private LocalDate startDate;
        private LocalDate endDate;
        private String status;
        private List<String> enterpriseIds;
        private List<String> projectIds;
        private List<String> attachments;
        private Boolean isPublic;
        private String createdBy;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PublicAgreementDto {
        private String id;
        private String name;
        private String type;
        private String status;
        private LocalDate startDate;
        private LocalDate endDate;
        private List<String> enterpriseIds;
        private List<String> projectIds;
    }

    // ===== 权限 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PermissionDto {
        private String id;
        private String tenantId;
        private String accountName;
        private String accountType;
        private String enterpriseId;
        private String expertId;
        private Boolean isEnabled;
        private Object resourcePermissions;
        private List<String> platformPermissions;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    // ===== 字典 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DictionaryDto {
        private String id;
        private String tenantId;
        private String dictType;
        private String code;
        private String name;
        private Integer sortOrder;
        private OffsetDateTime createdAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DictionaryCreateRequest {
        private String code;
        private String name;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DictionaryUpdateRequest {
        private String name;
        private Integer sortOrder;
    }

    // ===== 品牌 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BrandDto {
        private String id;
        private String tenantId;
        private String brandType;
        private String name;
        private String status;
        private Boolean isPublic;
        private Boolean isFeatured;
        private String coverImage;
        private String coverVideo;
        private String description;
        private Object data;
        private String studentId;
        private String enterpriseId;
        private String positionId;
        private String majorId;
        private String teacherId;
        private String expertId;
        private Integer sortOrder;
        private Integer viewCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EmployerBrandDto extends BrandDto {
        private String enterpriseName;
        private String enterpriseLogo;
        private String enterpriseIndustry;
        private String enterpriseRegion;
        private String enterpriseDescription;
        private String enterpriseCreditCode;
        private String enterpriseContactPerson;
        private String enterpriseContactPhone;
        private String enterpriseContactEmail;
        private String enterpriseAddress;
        private Integer enterpriseEstablishedYear;
        private Integer enterpriseEmployeeCount;
        private String enterpriseCoverImage;
        private List<String> enterpriseCoverPhotos;
        private List<String> enterpriseBusinessLicensePhotos;
        private List<String> enterpriseIntellectualPropertyPhotos;
        private List<String> enterpriseQualificationPhotos;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JobBrandDto extends BrandDto {
        private String positionName;
        private String positionType;
        private java.math.BigDecimal salaryMin;
        private java.math.BigDecimal salaryMax;
        private List<String> majorNames;
        private String positionStatus;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BrandResponsibility {
        private String id;
        private String careerPositionId;
        private String name;
        private String description;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BrandCertificate {
        private String id;
        private String careerPositionId;
        private String certificateLibraryId;
        private String name;
        private String url;
        private String description;
        private String imageUrl;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PublicBrandDto extends BrandDto {
        private String enterpriseName;
        private String enterpriseLogo;
        private String enterpriseIndustry;
        private String enterpriseRegion;
        private String enterpriseDescription;
        private String enterpriseCreditCode;
        private String enterpriseContactPerson;
        private String enterpriseContactPhone;
        private String enterpriseContactEmail;
        private String enterpriseAddress;
        private Integer enterpriseEstablishedYear;
        private Integer enterpriseEmployeeCount;
        private String enterpriseCoverImage;
        private List<String> enterpriseCoverPhotos;
        private List<String> enterpriseBusinessLicensePhotos;
        private List<String> enterpriseIntellectualPropertyPhotos;
        private List<String> enterpriseQualificationPhotos;
        private String positionName;
        private String positionType;
        private java.math.BigDecimal salaryMin;
        private java.math.BigDecimal salaryMax;
        private List<String> majorNames;
        private String industryName;
        private String positionStatus;
        private String positionDescription;
        private List<String> positionRequirements;
        private String positionCareerPath;
        private String positionCoverImage;
        private List<BrandResponsibility> responsibilities;
        private List<BrandCertificate> certificates;
        private String personName;
        private String personAvatar;
        private String personTitle;
        private String personPosition;
        private String personOrganization;
        private String personIndustry;
        private Integer personExperienceYears;
        private String personEducation;
        private String personIntroduction;
        private String personWorkExperience;
        private String personCity;
        private String personExpertType;
        private String personRating;
        private String personStatus;
        private String personGender;
        private Integer personAge;
        private List<String> personSpecialties;
        private List<String> personProfessionalFields;
        private List<String> personAttachments;
    }

    // ===== 人才排名 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BrandMajorRankConfigDto {
        private String majorId;
        private Boolean enabled;
        private Integer rankLimit;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RankConfigsSaveRequest {
        private List<BrandMajorRankConfigDto> configs;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TalentRankPositionDto {
        private String positionId;
        private String positionName;
        private Double achievementRate;
        private Double positionCompetency;
        private Double positionCompetencyV2;
        private Double abilityCognitionScore;
        private Integer totalAbilityPoints;
        private Integer achievedAbilityPoints;
        private String grade;
        private OffsetDateTime evaluatedAt;
        private Object abilityPointDetails;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TalentRankStudentDto {
        private String studentId;
        private String studentNo;
        private String name;
        private String majorId;
        private String majorName;
        private String className;
        private String departmentName;
        private Double avgAchievementRate;
        private Double avgPositionCompetency;
        private Double avgPositionCompetencyV2;
        private Double avgAbilityCognitionScore;
        private Integer positionCount;
        private OffsetDateTime latestEvaluatedAt;
        private List<TalentRankPositionDto> positions;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TalentRankMajorGroupDto {
        private String majorId;
        private String majorName;
        private Boolean enabled;
        private Integer rankLimit;
        private Integer studentCount;
        private List<TalentRankStudentDto> students;
    }

    // ===== 公开统计 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PublicStatsDto {
        private Integer enterpriseCount;
        private Integer projectCount;
        private Integer expertCount;
        private Integer achievementCount;
        private Integer brandCount;
    }
}
