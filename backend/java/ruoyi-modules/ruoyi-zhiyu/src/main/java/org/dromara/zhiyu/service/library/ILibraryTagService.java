package org.dromara.zhiyu.service.library;

import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CreateTagRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.QueryBindingsRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceTagRelationDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.SetResourceTagsRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.TagDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UpdateTagRequest;

import java.util.List;

/**
 * 标签服务（对齐 Go service/tag_service.go + store/tags.go 语义）。
 *
 * @author zhiyu
 */
public interface ILibraryTagService {

    /**
     * 租户标签列表（含绑定资源数量）。
     *
     * @return 标签列表
     */
    List<TagDto> list();

    /**
     * 创建标签（名称租户内唯一，重复 409）。
     *
     * @param req 创建请求
     * @return 完整标签
     */
    TagDto create(CreateTagRequest req);

    /**
     * 更新标签（名称/颜色；租户归属校验）。
     *
     * @param id  标签 ID
     * @param req 更新请求
     * @return 完整标签
     */
    TagDto update(String id, UpdateTagRequest req);

    /**
     * 删除标签（绑定关系级联清理；租户归属校验）。
     *
     * @param id 标签 ID
     * @return 删除的标签 ID
     */
    String delete(String id);

    /**
     * 全量替换某资源的标签绑定（事务：先删后插，幂等）。
     *
     * @param req 绑定请求
     */
    void setResourceTags(SetResourceTagsRequest req);

    /**
     * 批量查询资源的标签绑定（列表页标签展示用）。
     *
     * @param req 查询请求
     * @return 资源-标签绑定列表（按入参资源 ID 顺序）
     */
    List<ResourceTagRelationDto> queryBindings(QueryBindingsRequest req);
}
