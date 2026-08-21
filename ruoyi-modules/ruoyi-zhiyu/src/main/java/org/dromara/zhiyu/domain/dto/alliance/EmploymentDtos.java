package org.dromara.zhiyu.domain.dto.alliance;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 联盟就业 alliance-employment 域 DTO（对齐 Go domain/alliance_employment.go 与 shared-types alliance.ts）。
 *
 * @author zhiyu
 */
public final class EmploymentDtos {

    private EmploymentDtos() {
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TargetGroup {
        private String orgNodeId;
        private String orgNodeName;
        private String majorId;
        private String majorName;
        private Integer graduateYear;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EmploymentProjectDto {
        private String id;
        private String tenantId;
        private String name;
        private String type;
        private String organizer;
        private String description;
        private String coverImage;
        private LocalDate startDate;
        private LocalDate endDate;
        private String publishStatus;
        private List<String> enterpriseIds;
        private List<TargetGroup> targetGroups;
        private String createdBy;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private Integer jobCount;
        private Integer applicationCount;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EmploymentJobDto {
        private String id;
        private String tenantId;
        /** 企业端创建岗位时的学校租户（partner 契约 schoolTenantId） */
        private String schoolTenantId;
        private String enterpriseId;
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
        private LocalDate deadline;
        private String status;
        private String createdBy;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private String enterpriseName;
        private String projectName;
        private Integer applicationCount;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EmploymentApplicationDto {
        private String id;
        private String tenantId;
        private String jobId;
        private String enterpriseId;
        private String studentId;
        private String studentName;
        private String studentNo;
        private String majorName;
        private String className;
        private String phone;
        private String email;
        private String coverLetter;
        private String status;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private String jobTitle;
        private String enterpriseName;
        private String projectName;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class JobStatusRequest {
        private String status;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ApplyRequest {
        private String coverLetter;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PartnerJobStatusRequest {
        private String action;
        private String projectId;
    }
}
