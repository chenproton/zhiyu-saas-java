package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CertificateLibraryItemDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CertificateLibraryRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.UncitedItemDto;
import org.dromara.zhiyu.service.job.IJobCertificateLibraryService;
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
 * 证书库控制器（对齐 Go routes_job.go 的 /job/certificate-library 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/certificate-library")
public class JobCertificateLibraryController {

    private final IJobCertificateLibraryService certificateLibraryService;

    /** 证书库列表（search/creatorId 过滤） */
    @GetMapping
    public ListResponse<CertificateLibraryItemDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                                        @RequestParam(value = "offset", required = false) Long offset,
                                                        @RequestParam(value = "search", required = false) String search,
                                                        @RequestParam(value = "creatorId", required = false) String creatorId) {
        return certificateLibraryService.list(search, creatorId,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 证书库详情 */
    @GetMapping("/{id}")
    public CertificateLibraryItemDto get(@PathVariable String id) {
        return certificateLibraryService.get(id);
    }

    /** 创建证书库条目 */
    @PostMapping
    public CertificateLibraryItemDto create(@RequestBody CertificateLibraryRequest req) {
        return certificateLibraryService.create(req);
    }

    /** 更新证书库条目 */
    @PutMapping("/{id}")
    public CertificateLibraryItemDto update(@PathVariable String id, @RequestBody CertificateLibraryRequest req) {
        return certificateLibraryService.update(id, req);
    }

    /** 删除证书库条目 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", certificateLibraryService.delete(id));
    }

    /** 引用次数分布统计（顶部指标卡片用） */
    @GetMapping("/citation-stats")
    public CitationStatsDto citationStats() {
        return certificateLibraryService.citationStats();
    }

    /** 零引用证书列表（startDate/endDate 时段筛选 + 分页） */
    @GetMapping("/uncited")
    public ListResponse<UncitedItemDto> uncited(@RequestParam(value = "startDate", required = false) String startDate,
                                                @RequestParam(value = "endDate", required = false) String endDate,
                                                @RequestParam(value = "limit", required = false) Long limit,
                                                @RequestParam(value = "offset", required = false) Long offset) {
        return certificateLibraryService.uncited(startDate, endDate,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }
}
