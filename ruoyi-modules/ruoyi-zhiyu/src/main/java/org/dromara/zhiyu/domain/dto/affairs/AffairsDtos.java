package org.dromara.zhiyu.domain.dto.affairs;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 教务域 DTO 与请求载荷（对齐 shared-types affairs.ts，前端契约零改动）。
 *
 * @author zhiyu
 */
public final class AffairsDtos {

    private AffairsDtos() {
    }

    // ===== 学期 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TermDto {
        private String id;
        private String name;
        private String startDate;
        private String endDate;
        private Integer weeksCount;
        private Boolean isCurrent;
        private OffsetDateTime createdAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TermPayload {
        private String name;
        private String startDate;
        private String endDate;
        private Integer weeksCount;
        private Boolean isCurrent;
    }

    // ===== 人培方案 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TrainingProgramDto {
        private String id;
        private String name;
        private String code;
        private String majorId;
        private String majorName;
        private Integer entryYear;
        private String level;
        private Integer duration;
        private Double totalCredits;
        private String status;
        private String description;
        private Integer courseCount;
        private String createdBy;
        private String createdByName;
        private List<String> collaborators;
        private List<String> collaboratorNames;
        private String batchId;
        private String batchName;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TrainingProgramPayload {
        private String name;
        private String code;
        private String majorId;
        private Integer entryYear;
        private String level;
        private Integer duration;
        private Double totalCredits;
        private String description;
        private String batchId;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TrainingProgramCourseDto {
        private String id;
        private String programId;
        private String name;
        private String code;
        private Double credits;
        private Integer hours;
        private Integer semester;
        private String nature;
        private String assessment;
        private String positionId;
        private String positionName;
        private String courseId;
        private String courseName;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ProgramCoursePayload {
        private String name;
        private String code;
        private Double credits;
        private Integer hours;
        private Integer semester;
        private String nature;
        private String assessment;
        private String positionId;
        private String courseId;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PutProgramCoursesRequest {
        private List<ProgramCoursePayload> courses;
    }

    // ===== 场地 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VenueDto {
        private String id;
        private String name;
        private String type;
        private Integer capacity;
        private OffsetDateTime createdAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VenuePayload {
        private String name;
        private String type;
        private Integer capacity;
    }

    // ===== 节次 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PeriodSlotDto {
        private String id;
        private String name;
        private String type;
        private Integer sortOrder;
        private String startTime;
        private String endTime;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PeriodSlotPayload {
        private String name;
        private String type;
        private Integer sortOrder;
        private String startTime;
        private String endTime;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ReplacePeriodSlotsRequest {
        private List<PeriodSlotPayload> items;
    }

    // ===== 教务批次 =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AffairsBatchDto {
        private String id;
        private String tenantId;
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String majorName;
        private String workflowId;
        private String status;
        private Integer programCount;
        private Integer publishedCount;
        private Integer pendingCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AffairsBatchPayload {
        private String name;
        private String code;
        private String orgNodeId;
        private String majorId;
        private String workflowId;
        private String status;
    }

    // ===== 内容动作公共载荷（人培方案/教学计划共用） =====

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ReviewRequest {
        private String status;
        private String comment;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class InviteRequest {
        private String userId;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CloneRequest {
        private String name;
        private String code;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class StatusRequest {
        private String status;
    }
}
