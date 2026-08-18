package org.dromara.zhiyu.controller.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.ExcelExport;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.AutoScheduleRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.PublishSchedulesRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.ScheduleEntryPayload;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.TimetableResponse;
import org.dromara.zhiyu.domain.dto.portal.ScheduleDtos.ScheduleEntryDto;
import org.dromara.zhiyu.service.affairs.ISchedulingService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * 排课控制器（对齐 Go /affairs/schedules 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/affairs/schedules")
public class AffairsScheduleController {

    private final ISchedulingService schedulingService;

    @GetMapping
    public ListResponse<ScheduleEntryDto> list(@RequestParam(value = "termId", required = false) String termId,
                                               @RequestParam(value = "status", required = false) String status,
                                               @RequestParam(value = "classNodeId", required = false) String classNodeId,
                                               @RequestParam(value = "teacherId", required = false) String teacherId,
                                               @RequestParam(value = "type", required = false) String type,
                                               @RequestParam(value = "limit", required = false) Long limit,
                                               @RequestParam(value = "offset", required = false) Long offset) {
        return schedulingService.listSchedules(termId, status, classNodeId, teacherId, type,
            limit == null ? 200 : limit, offset == null ? 0 : offset);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleEntryDto create(@RequestBody ScheduleEntryPayload payload) {
        return schedulingService.createSchedule(payload);
    }

    @PutMapping("/{id}")
    public ScheduleEntryDto update(@PathVariable String id, @RequestBody ScheduleEntryPayload payload) {
        return schedulingService.updateSchedule(id, payload);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", schedulingService.deleteSchedule(id));
    }

    @PostMapping("/publish")
    public Map<String, Object> publish(@RequestBody PublishSchedulesRequest req) {
        return schedulingService.publishSchedules(req);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam("termId") String termId) {
        ExcelExport file = schedulingService.exportSchedules(termId);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(file.filename(), StandardCharsets.UTF_8).build().toString())
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(file.content());
    }

    @GetMapping("/timetable")
    public TimetableResponse timetable(@RequestParam("termId") String termId,
                                       @RequestParam(value = "classNodeId", required = false) String classNodeId,
                                       @RequestParam(value = "teacherId", required = false) String teacherId,
                                       @RequestParam(value = "status", required = false) String status) {
        return schedulingService.timetable(termId, classNodeId, teacherId, status);
    }

    @PostMapping("/auto-schedule")
    public Map<String, Object> autoSchedule(@RequestBody AutoScheduleRequest req) {
        return schedulingService.autoSchedule(req);
    }
}
