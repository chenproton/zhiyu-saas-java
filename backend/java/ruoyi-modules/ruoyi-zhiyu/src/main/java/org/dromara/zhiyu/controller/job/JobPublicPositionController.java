package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CareerPositionDto;
import org.dromara.zhiyu.service.job.IJobPositionService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 公开岗位控制器（对齐 Go routes.go 的 /job/public/positions 路由组，学生落地页只读引用）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/public/positions")
public class JobPublicPositionController {

    private final IJobPositionService positionService;

    /** 公开岗位列表（仅已发布） */
    @GetMapping
    public ListResponse<CareerPositionDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                                @RequestParam(value = "offset", required = false) Long offset,
                                                @RequestParam(value = "search", required = false) String search,
                                                @RequestParam(value = "positionType", required = false) String positionType) {
        return positionService.publicList(search, positionType,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 公开岗位详情（记录浏览量） */
    @GetMapping("/{id}")
    public CareerPositionDto get(@PathVariable String id) {
        return positionService.publicGet(id);
    }
}
