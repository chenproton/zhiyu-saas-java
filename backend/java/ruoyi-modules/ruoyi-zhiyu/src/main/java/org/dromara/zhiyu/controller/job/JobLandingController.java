package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CareerPositionDto;
import org.dromara.zhiyu.service.job.IJobPositionService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 落地页控制器（对齐 Go registerLandingRoutes 的 /job/landing 路由组）。
 *
 * <p>当前学生目标岗位（唯一来源：人培方案按班级排的岗位），供学生角色落地页使用。</p>
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/landing")
public class JobLandingController {

    private final IJobPositionService positionService;

    /** 学生目标岗位列表 */
    @GetMapping("/target-positions")
    public ListResponse<CareerPositionDto> listTargetPositions() {
        return positionService.listTargetPositions();
    }
}
