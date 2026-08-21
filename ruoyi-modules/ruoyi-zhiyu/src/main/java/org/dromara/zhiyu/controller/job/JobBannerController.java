package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.BannerRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.JobBannerConfigDto;
import org.dromara.zhiyu.service.job.IJobBannerService;
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
 * 岗位轮播图控制器（对齐 Go routes_job.go 的 /job/banners 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/banners")
public class JobBannerController {

    private final IJobBannerService bannerService;

    /** 轮播图列表（isEnabled 过滤） */
    @GetMapping
    public ListResponse<JobBannerConfigDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                                 @RequestParam(value = "offset", required = false) Long offset,
                                                 @RequestParam(value = "isEnabled", required = false) String isEnabled) {
        return bannerService.list(isEnabled, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 轮播图详情 */
    @GetMapping("/{id}")
    public JobBannerConfigDto get(@PathVariable String id) {
        return bannerService.get(id);
    }

    /** 创建轮播图 */
    @PostMapping
    public JobBannerConfigDto create(@RequestBody BannerRequest req) {
        return bannerService.create(req);
    }

    /** 更新轮播图 */
    @PutMapping("/{id}")
    public JobBannerConfigDto update(@PathVariable String id, @RequestBody BannerRequest req) {
        return bannerService.update(id, req);
    }

    /** 删除轮播图 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", bannerService.delete(id));
    }
}
