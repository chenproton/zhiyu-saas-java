package org.dromara.zhiyu.service.affairs;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.PeriodSlotDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.PeriodSlotPayload;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ReplacePeriodSlotsRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.VenueDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.VenuePayload;
import org.dromara.zhiyu.domain.dto.affairs.ExcelExport;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.AutoScheduleRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.PublishSchedulesRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.ScheduleEntryPayload;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.TimetableResponse;
import org.dromara.zhiyu.domain.dto.portal.ScheduleDtos.ScheduleEntryDto;

import java.util.Map;

/**
 * 教务排课服务（场地/节次/排课；对齐 Go scheduling_handler.go + store/scheduling.go）。
 *
 * @author zhiyu
 */
public interface ISchedulingService {

    // 场地
    ListResponse<VenueDto> listVenues(String search, String type, long limit, long offset);

    VenueDto getVenue(String id);

    VenueDto createVenue(VenuePayload payload);

    VenueDto updateVenue(String id, VenuePayload payload);

    String deleteVenue(String id);

    // 节次
    ListResponse<PeriodSlotDto> listPeriodSlots(long limit, long offset);

    PeriodSlotDto getPeriodSlot(String id);

    PeriodSlotDto createPeriodSlot(PeriodSlotPayload payload);

    PeriodSlotDto updatePeriodSlot(String id, PeriodSlotPayload payload);

    String deletePeriodSlot(String id);

    ListResponse<PeriodSlotDto> replacePeriodSlots(ReplacePeriodSlotsRequest req);

    // 排课
    ListResponse<ScheduleEntryDto> listSchedules(String termId, String status, String classNodeId, String teacherId,
                                                 String type, long limit, long offset);

    ScheduleEntryDto createSchedule(ScheduleEntryPayload payload);

    ScheduleEntryDto updateSchedule(String id, ScheduleEntryPayload payload);

    String deleteSchedule(String id);

    Map<String, Object> publishSchedules(PublishSchedulesRequest req);

    ExcelExport exportSchedules(String termId);

    TimetableResponse timetable(String termId, String classNodeId, String teacherId, String status);

    Map<String, Object> autoSchedule(AutoScheduleRequest req);
}
