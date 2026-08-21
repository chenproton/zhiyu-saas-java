package org.dromara.zhiyu.controller.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.VenueDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.VenuePayload;
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
 * 场地控制器（对齐 Go /affairs/venues 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/affairs/venues")
public class AffairsVenueController {

    private final ISchedulingService schedulingService;

    @GetMapping
    public ListResponse<VenueDto> list(@RequestParam(value = "search", required = false) String search,
                                       @RequestParam(value = "type", required = false) String type,
                                       @RequestParam(value = "limit", required = false) Long limit,
                                       @RequestParam(value = "offset", required = false) Long offset) {
        return schedulingService.listVenues(search, type, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VenueDto create(@RequestBody VenuePayload payload) {
        return schedulingService.createVenue(payload);
    }

    @PutMapping("/{id}")
    public VenueDto update(@PathVariable String id, @RequestBody VenuePayload payload) {
        return schedulingService.updateVenue(id, payload);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", schedulingService.deleteVenue(id));
    }
}
