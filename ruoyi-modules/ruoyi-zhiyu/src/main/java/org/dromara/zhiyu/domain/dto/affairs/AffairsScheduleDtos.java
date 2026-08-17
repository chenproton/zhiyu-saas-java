package org.dromara.zhiyu.domain.dto.affairs;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import org.dromara.zhiyu.domain.dto.portal.ScheduleDtos.ScheduleEntryDto;

import java.util.List;

/**
 * 教务排课 DTO 与请求载荷（复用 portal ScheduleEntryDto 作为排课条目响应体）。
 *
 * @author zhiyu
 */
public final class AffairsScheduleDtos {

    private AffairsScheduleDtos() {
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ScheduleEntryPayload {
        private String termId;
        private String planEntryId;
        private String courseName;
        private String courseCode;
        private String courseId;
        private String type;
        private String classNodeId;
        private List<String> classNodeIds;
        private String teacherId;
        private Integer dayOfWeek;
        private List<String> periods;
        private Integer startWeek;
        private Integer endWeek;
        private String weekPattern;
        private String venueId;
        private String scenarioId;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ScheduleConflict {
        private String kind;
        private String entryId;
        private String courseName;
        private String className;
        private String teacherName;
        private String venueName;
        private Integer dayOfWeek;
        private List<String> periods;
        private Integer startWeek;
        private Integer endWeek;
        private String weekPattern;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TimetableResponse {
        private List<ScheduleEntryDto> items;
        private int total;
        private int version;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PublishSchedulesRequest {
        private String termId;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AutoScheduleRequest {
        private String termId;
        private String planId;
    }
}
