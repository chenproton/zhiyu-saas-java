package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionRecommendationDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.RecommendRequest;
import org.dromara.zhiyu.service.job.IJobRecommendService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 岗位推荐控制器（对齐 Go routes_job.go 的 /job/recommendations 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/recommendations")
public class JobRecommendController {

    private final IJobRecommendService recommendService;

    /** 推荐列表（majorId/careerPositionId 过滤） */
    @GetMapping
    public ListResponse<PositionRecommendationDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                                        @RequestParam(value = "offset", required = false) Long offset,
                                                        @RequestParam(value = "majorId", required = false) String majorId,
                                                        @RequestParam(value = "careerPositionId", required = false) String careerPositionId) {
        return recommendService.list(majorId, careerPositionId,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 创建推荐 */
    @PostMapping
    public PositionRecommendationDto create(@RequestBody RecommendRequest req) {
        return recommendService.create(req);
    }

    /** 更新推荐 */
    @PutMapping("/{id}")
    public PositionRecommendationDto update(@PathVariable String id, @RequestBody RecommendRequest req) {
        return recommendService.update(id, req);
    }

    /** 删除推荐 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", recommendService.delete(id));
    }
}
