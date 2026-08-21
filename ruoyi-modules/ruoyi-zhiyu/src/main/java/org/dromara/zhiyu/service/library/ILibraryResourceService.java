package org.dromara.zhiyu.service.library;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CreateResourceRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.PreviewImportRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceLibraryItemDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceTypeCountDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UpdateResourceRequest;

import java.util.List;

/**
 * 资源库服务（对齐 Go service/resource.go + store/resource_library.go 语义）。
 *
 * @author zhiyu
 */
public interface ILibraryResourceService {

    /**
     * 资源列表（tenant + search/resourceType/orgName/majorName/uploadedBy/tagIds 过滤，按创建时间倒序）。
     *
     * @param tagIds 逗号分隔的标签 ID（未拆分，Service 内拆分去重）
     */
    ListResponse<ResourceLibraryItemDto> list(String search, String resourceType, String orgName,
                                              String majorName, String uploadedBy, String tagIds,
                                              int limit, int offset);

    /**
     * 资源详情（租户归属校验，非本租户 403）。
     *
     * @param id 资源 ID
     * @return 资源条目
     */
    ResourceLibraryItemDto get(String id);

    /**
     * 创建资源。
     *
     * @param req 创建请求
     * @return 完整资源条目
     */
    ResourceLibraryItemDto create(CreateResourceRequest req);

    /**
     * 更新资源（部分更新：null 字段保留原值）。
     *
     * @param id  资源 ID
     * @param req 更新请求
     * @return 完整资源条目
     */
    ResourceLibraryItemDto update(String id, UpdateResourceRequest req);

    /**
     * 删除资源（事务内级联清理标签绑定）。
     *
     * @param id 资源 ID
     * @return 删除的资源 ID
     */
    String delete(String id);

    /**
     * 按类型统计资源数量（可选 search 过滤）。
     *
     * @param search 搜索关键字
     * @return 类型统计列表
     */
    List<ResourceTypeCountDto> stats(String search);

    /**
     * 资源引用次数分布（可选 resourceType 过滤）。
     *
     * @param resourceType 资源类型
     * @return 引用统计
     */
    CitationStatsDto citationStats(String resourceType);

    /**
     * 零引用资源列表（上传时段筛选 + 分页；可选 resourceType 过滤）。
     *
     * @param startDate YYYY-MM-DD（可选）
     * @param endDate   YYYY-MM-DD 含当天（可选）
     */
    ListResponse<UncitedItemDto> uncited(String resourceType, String startDate, String endDate,
                                         int limit, int offset);

    /**
     * 批量导入前按名称校验重名，返回已存在的资源列表。
     *
     * @param req 重名校验请求
     * @return 已存在资源列表
     */
    ListResponse<ResourceLibraryItemDto> previewImport(PreviewImportRequest req);
}
