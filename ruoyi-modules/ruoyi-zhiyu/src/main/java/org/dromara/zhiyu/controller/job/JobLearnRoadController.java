package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.LearnRoadDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.LearnRoadRequest;
import org.dromara.zhiyu.service.job.IJobLearnRoadService;
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
 * 学习路径控制器（对齐 Go routes_job.go 的 /job/learn-roads 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/learn-roads")
public class JobLearnRoadController {

    private final IJobLearnRoadService learnRoadService;

    /** 学习路径列表（name 模糊过滤） */
    @GetMapping
    public ListResponse<LearnRoadDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                           @RequestParam(value = "offset", required = false) Long offset,
                                           @RequestParam(value = "name", required = false) String name) {
        return learnRoadService.list(name, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 学习路径详情 */
    @GetMapping("/{id}")
    public LearnRoadDto get(@PathVariable String id) {
        return learnRoadService.get(id);
    }

    /** 创建学习路径 */
    @PostMapping
    public LearnRoadDto create(@RequestBody LearnRoadRequest req) {
        return learnRoadService.create(req);
    }

    /** 更新学习路径 */
    @PutMapping("/{id}")
    public LearnRoadDto update(@PathVariable String id, @RequestBody LearnRoadRequest req) {
        return learnRoadService.update(id, req);
    }

    /** 删除学习路径 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", learnRoadService.delete(id));
    }
}
