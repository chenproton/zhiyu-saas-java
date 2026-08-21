package org.dromara.zhiyu.domain.dto.affairs;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 教学计划 DTO 与请求载荷（对齐 shared-types affairs.ts）。
 *
 * @author zhiyu
 */
public final class TeachingPlanDtos {

    private TeachingPlanDtos() {
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TeachingPlanDto {
        private String id;
        private String programId;
        private String programName;
        private String termId;
        private String termName;
        private String majorId;
        private String majorName;
        private Integer entryYear;
        private String status;
        private Integer entryCount;
        private OffsetDateTime generatedAt;
        private OffsetDateTime confirmedAt;
        private String createdBy;
        private String createdByName;
        private List<String> collaborators;
        private List<String> collaboratorNames;
        private String batchId;
        private String batchName;
        private OffsetDateTime updatedAt;
        /** 详情时携带（列表为 null，经 NON_NULL 省略） */
        private List<TeachingPlanEntryDto> entries;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TeachingPlanEntryDto {
        private String id;
        private String planId;
        private String courseName;
        private String courseCode;
        private String courseId;
        private String type;
        private String nature;
        private Double credits;
        private Integer totalHours;
        private Integer weekHours;
        private Integer startWeek;
        private Integer endWeek;
        private String weekPattern;
        private String classNodeId;
        private String className;
        private List<String> classNodeIds;
        private List<String> classNames;
        private String teacherId;
        private String teacherName;
        private String teacherType;
        private String venueType;
        private String scenarioId;
        private String scenarioName;
        private String positionName;
        private String linkedCourseName;
        private String status;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class GenerateTeachingPlanRequest {
        private String programId;
        private String termId;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UpdateTeachingPlanRequest {
        private String batchId;
        private List<String> collaborators;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TeachingPlanEntryUpdatePayload {
        private Integer weekHours;
        private Integer startWeek;
        private Integer endWeek;
        private String weekPattern;
        private String classNodeId;
        private List<String> classNodeIds;
        private String teacherId;
        private String teacherType;
        private String venueType;
        private String status;
        private Double credits;
        private Integer totalHours;
    }
}
