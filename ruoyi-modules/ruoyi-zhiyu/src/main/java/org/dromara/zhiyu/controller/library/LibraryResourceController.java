package org.dromara.zhiyu.controller.library;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CreateResourceRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.PreviewImportRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceLibraryItemDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceTypeCountDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UpdateResourceRequest;
import org.dromara.zhiyu.service.library.ILibraryResourceService;
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

import java.util.List;
import java.util.Map;

/**
 * 资源库控制器（对齐 Go router/routes_library.go 的 /library/resources 路由组）。
 *
 * <p>列表分页 limit/offset（默认 50、上限 200），成功返回裸 JSON（ListResponse/DTO），
 * 错误抛 {@link org.dromara.zhiyu.core.web.ApiException} 对齐 Go errorResponse。</p>
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/library/resources")
public class LibraryResourceController {

    private final ILibraryResourceService resourceService;

    /** 资源列表（search/resourceType/orgName/majorName/uploadedBy/tagIds 过滤） */
    @GetMapping
    public ListResponse<ResourceLibraryItemDto> list(
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "resourceType", required = false) String resourceType,
        @RequestParam(value = "orgName", required = false) String orgName,
        @RequestParam(value = "majorName", required = false) String majorName,
        @RequestParam(value = "uploadedBy", required = false) String uploadedBy,
        @RequestParam(value = "tagIds", required = false) String tagIds,
        @RequestParam(value = "limit", required = false, defaultValue = "50") int limit,
        @RequestParam(value = "offset", required = false, defaultValue = "0") int offset) {
        return resourceService.list(search, resourceType, orgName, majorName, uploadedBy, tagIds, limit, offset);
    }

    /** 资源详情 */
    @GetMapping("/{id}")
    public ResourceLibraryItemDto get(@PathVariable String id) {
        return resourceService.get(id);
    }

    /** 新建资源（元数据端点；文件上传演示环境简化为记录 URL） */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResourceLibraryItemDto create(@RequestBody CreateResourceRequest req) {
        return resourceService.create(req);
    }

    /** 更新资源（部分更新：null 字段保留原值） */
    @PutMapping("/{id}")
    public ResourceLibraryItemDto update(@PathVariable String id, @RequestBody UpdateResourceRequest req) {
        return resourceService.update(id, req);
    }

    /** 删除资源 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", resourceService.delete(id));
    }

    /** 按类型统计（列表总览统计卡片） */
    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam(value = "search", required = false) String search) {
        List<ResourceTypeCountDto> counts = resourceService.stats(search);
        return Map.of("items", counts);
    }

    /** 资源引用次数分布（顶部指标卡片） */
    @GetMapping("/citation-stats")
    public CitationStatsDto citationStats(@RequestParam(value = "resourceType", required = false) String resourceType) {
        return resourceService.citationStats(resourceType);
    }

    /** 零引用资源列表（上传时段筛选 + 分页） */
    @GetMapping("/uncited")
    public ListResponse<UncitedItemDto> uncited(
        @RequestParam(value = "resourceType", required = false) String resourceType,
        @RequestParam(value = "startDate", required = false) String startDate,
        @RequestParam(value = "endDate", required = false) String endDate,
        @RequestParam(value = "limit", required = false, defaultValue = "20") int limit,
        @RequestParam(value = "offset", required = false, defaultValue = "0") int offset) {
        return resourceService.uncited(resourceType, startDate, endDate, limit, offset);
    }

    /** 批量导入前按名称校验重名 */
    @PostMapping("/import/preview")
    public ListResponse<ResourceLibraryItemDto> previewImport(@RequestBody PreviewImportRequest req) {
        return resourceService.previewImport(req);
    }
}
