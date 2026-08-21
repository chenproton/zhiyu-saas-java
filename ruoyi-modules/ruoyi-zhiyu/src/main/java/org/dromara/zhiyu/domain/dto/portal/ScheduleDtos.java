package org.dromara.zhiyu.domain.dto.portal;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * 我的课表 DTO（对齐 Go scheduling_handler.go MySchedule 响应与 shared-types affairs.ts）。
 *
 * @author zhiyu
 */
public class ScheduleDtos {

    /** 学期简览（AffairsTerm，FetchTermBrief 口径） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TermDto {
        private String id;
        private String name;
        private String startDate;
        private String endDate;
        private Integer weeksCount;
        private Boolean isCurrent;
        private java.time.OffsetDateTime createdAt;
    }

    /** 排课条目（ScheduleEntry，含关联名称） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ScheduleEntryDto {
        private String id;
        private String termId;
        private String planEntryId;
        private String courseName;
        private String courseCode;
        private String courseId;
        /** traditional/scene */
        private String type;
        private String classNodeId;
        private String className;
        private List<String> classNodeIds;
        private List<String> classNames;
        private String teacherId;
        private String teacherName;
        private Integer dayOfWeek;
        private List<String> periods;
        private Integer startWeek;
        private Integer endWeek;
        private String weekPattern;
        private String venueId;
        private String venueName;
        private String scenarioId;
        private String scenarioName;
        private String source;
        private String status;
        private Integer version;
        private String resourceVersion;
        private java.time.OffsetDateTime createdAt;
        private java.time.OffsetDateTime updatedAt;
    }

    /** 我的课表响应（MyScheduleResponse） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MyScheduleResponse {
        private TermDto term;
        /** student/teacher */
        private String viewAs;
        private List<ScheduleEntryDto> items;
        private Integer total;
    }
}
