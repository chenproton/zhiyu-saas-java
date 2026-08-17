package org.dromara.zhiyu.controller.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.PeriodSlotDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.PeriodSlotPayload;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ReplacePeriodSlotsRequest;
import org.dromara.zhiyu.service.affairs.ISchedulingService;
import org.springframework.http.HttpStatus;
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

import java.util.Map;

/**
 * 节次控制器（对齐 Go /affairs/period-slots 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/affairs/period-slots")
public class AffairsPeriodSlotController {

    private final ISchedulingService schedulingService;

    @GetMapping
    public ListResponse<PeriodSlotDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                            @RequestParam(value = "offset", required = false) Long offset) {
        return schedulingService.listPeriodSlots(limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public PeriodSlotDto get(@PathVariable String id) {
        return schedulingService.getPeriodSlot(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PeriodSlotDto create(@RequestBody PeriodSlotPayload payload) {
        return schedulingService.createPeriodSlot(payload);
    }

    @PutMapping("/replace")
    public ListResponse<PeriodSlotDto> replace(@RequestBody ReplacePeriodSlotsRequest req) {
        return schedulingService.replacePeriodSlots(req);
    }

    @PutMapping("/{id}")
    public PeriodSlotDto update(@PathVariable String id, @RequestBody PeriodSlotPayload payload) {
        return schedulingService.updatePeriodSlot(id, payload);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", schedulingService.deletePeriodSlot(id));
    }
}
