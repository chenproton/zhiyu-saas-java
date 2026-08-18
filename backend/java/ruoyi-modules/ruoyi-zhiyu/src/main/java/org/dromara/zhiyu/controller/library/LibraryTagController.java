package org.dromara.zhiyu.controller.library;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CreateTagRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.QueryBindingsRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceTagRelationDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.SetResourceTagsRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.TagDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UpdateTagRequest;
import org.dromara.zhiyu.service.library.ILibraryTagService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 标签控制器（对齐 Go /library/tags 与 /library/resource-tags 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/library")
public class LibraryTagController {

    private final ILibraryTagService tagService;

    /** 标签列表（含绑定资源数量） */
    @GetMapping("/tags")
    public Map<String, Object> list() {
        List<TagDto> items = tagService.list();
        return Map.of("items", items);
    }

    /** 创建标签 */
    @PostMapping("/tags")
    @ResponseStatus(HttpStatus.CREATED)
    public TagDto create(@RequestBody CreateTagRequest req) {
        return tagService.create(req);
    }

    /** 更新标签（名称/颜色） */
    @PutMapping("/tags/{id}")
    public TagDto update(@PathVariable String id, @RequestBody UpdateTagRequest req) {
        return tagService.update(id, req);
    }

    /** 删除标签（绑定关系级联清理） */
    @DeleteMapping("/tags/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", tagService.delete(id));
    }

    /** 全量替换某资源的标签绑定 */
    @PostMapping("/resource-tags")
    public Map<String, Boolean> setResourceTags(@RequestBody SetResourceTagsRequest req) {
        tagService.setResourceTags(req);
        return Map.of("ok", true);
    }

    /** 批量查询资源的标签绑定（列表页标签展示） */
    @PostMapping("/resource-tags/query")
    public Map<String, Object> queryBindings(@RequestBody QueryBindingsRequest req) {
        List<ResourceTagRelationDto> items = tagService.queryBindings(req);
        return Map.of("items", items);
    }
}
