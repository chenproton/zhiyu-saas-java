package org.dromara.zhiyu.service.impl.library;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CreateTagRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.QueryBindingsRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceTagRelationDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.SetResourceTagsRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.TagDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.TagRelationRow;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UpdateTagRequest;
import org.dromara.zhiyu.domain.library.LibraryTag;
import org.dromara.zhiyu.mapper.library.LibraryResourceTagRelationMapper;
import org.dromara.zhiyu.mapper.library.LibraryTagMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.library.ILibraryTagService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 标签服务实现（对齐 Go tag_handler.go + service/tag_service.go + store/tags.go 语义）。
 *
 * <p>标签名称租户内唯一（tags_tenant_id_name_key），重复插入/更新捕获
 * {@link DuplicateKeyException} 映射 409；更新/删除先做租户归属校验（403）。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LibraryTagServiceImpl implements ILibraryTagService {

    /** 颜色格式（对齐 Go hexColorPattern：^#[0-9a-fA-F]{6}$） */
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");

    /** 默认颜色（对齐 Go Create 缺省 #6366f1） */
    private static final String DEFAULT_COLOR = "#6366f1";

    /** 可绑定标签的资源类型白名单（与 shared-types TAG_RESOURCE_TYPES 一一对应） */
    private static final Set<String> TAG_RESOURCE_TYPES = Set.of(
        "knowledge_point", "resource_library", "ability_point", "certificate_library", "random_draw_question"
    );

    /** 单次查询资源数量上限（对齐 Go QueryBindings 200 限制） */
    private static final int MAX_QUERY_IDS = 200;

    private final SystemGuard systemGuard;
    private final LibraryTagMapper tagMapper;
    private final LibraryResourceTagRelationMapper tagRelationMapper;

    @Override
    public List<TagDto> list() {
        String tenantId = systemGuard.requireTenant();
        List<LibraryTag> rows = tagMapper.selectWithResourceCount(tenantId);
        return rows.stream().map(this::toDto).toList();
    }

    @Override
    public TagDto create(CreateTagRequest req) {
        String tenantId = systemGuard.requireTenant();
        String name = req.getName() == null ? "" : req.getName().trim();
        validateName(name);
        String color = req.getColor() == null ? "" : req.getColor().trim();
        if (color.isEmpty()) {
            color = DEFAULT_COLOR;
        }
        validateColor(color);

        LibraryTag tag = new LibraryTag();
        tag.setTenantId(tenantId);
        tag.setName(name);
        tag.setColor(color);
        try {
            tagMapper.insert(tag);
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "conflict", "标签名称已存在");
        }
        LibraryTag created = tagMapper.selectById(tag.getId());
        if (created == null) {
            throw new ApiException(500, "internal_error", "创建标签失败");
        }
        return toDto(created);
    }

    @Override
    public TagDto update(String id, UpdateTagRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        String name = req.getName() == null ? "" : req.getName().trim();
        validateName(name);
        String color = req.getColor() == null ? "" : req.getColor().trim();
        validateColor(color);

        fetchOwned(id, tenantId);
        try {
            tagMapper.updateOwned(id, tenantId, name, color);
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "conflict", "标签名称已存在");
        }
        LibraryTag updated = tagMapper.selectById(id);
        if (updated == null) {
            throw new ApiException(500, "internal_error", "更新标签失败");
        }
        return toDto(updated);
    }

    @Override
    public String delete(String id) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        fetchOwned(id, tenantId);
        tagMapper.deleteOwned(id, tenantId);
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void setResourceTags(SetResourceTagsRequest req) {
        String tenantId = systemGuard.requireTenant();
        if (!TAG_RESOURCE_TYPES.contains(req.getResourceType())) {
            throw new ApiException(400, "bad_request", "不支持的资源类型");
        }
        if (req.getResourceId() == null || req.getResourceId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少资源 ID");
        }
        // 全量替换：先删后插，tagIds 去重（对齐 Go SetResourceTags）
        tagRelationMapper.deleteByResource(tenantId, req.getResourceType(), req.getResourceId());
        Set<String> dedup = new LinkedHashSet<>();
        if (req.getTagIds() != null) {
            for (String tagId : req.getTagIds()) {
                if (tagId != null && !tagId.isEmpty()) {
                    dedup.add(tagId);
                }
            }
        }
        for (String tagId : dedup) {
            tagRelationMapper.insertRelation(UUID.randomUUID().toString(), tenantId, tagId,
                req.getResourceType(), req.getResourceId());
        }
    }

    @Override
    public List<ResourceTagRelationDto> queryBindings(QueryBindingsRequest req) {
        String tenantId = systemGuard.requireTenant();
        if (!TAG_RESOURCE_TYPES.contains(req.getResourceType())) {
            throw new ApiException(400, "bad_request", "不支持的资源类型");
        }
        // 数量上限按入参原始长度校验（对齐 Go len(req.ResourceIDs) > 200）
        if (req.getResourceIds() != null && req.getResourceIds().size() > MAX_QUERY_IDS) {
            throw new ApiException(400, "bad_request", "单次查询资源数量过多");
        }
        List<String> resourceIds = dedupNonEmpty(req.getResourceIds());
        if (resourceIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<TagRelationRow> rows = tagRelationMapper.selectTagRelations(tenantId, req.getResourceType(), resourceIds);
        // 按资源 ID 聚合（保持入参顺序，无绑定的资源不出现，对齐 Go QueryBindings）
        Map<String, List<TagDto>> bucket = new LinkedHashMap<>();
        for (TagRelationRow row : rows) {
            bucket.computeIfAbsent(row.getResourceId(), k -> new ArrayList<>()).add(toTagDto(row));
        }
        List<ResourceTagRelationDto> items = new ArrayList<>();
        for (String resourceId : resourceIds) {
            List<TagDto> tags = bucket.get(resourceId);
            if (tags != null) {
                ResourceTagRelationDto rel = new ResourceTagRelationDto();
                rel.setResourceId(resourceId);
                rel.setTags(tags);
                items.add(rel);
            }
        }
        return items;
    }

    // ---------- 组装/工具 ----------

    private LibraryTag fetchOwned(String id, String tenantId) {
        LibraryTag tag = tagMapper.selectById(id);
        if (tag == null) {
            throw new ApiException(404, "not_found", "标签不存在");
        }
        if (!tenantId.equals(tag.getTenantId())) {
            throw new ApiException(403, "forbidden", "没有访问权限");
        }
        return tag;
    }

    private TagDto toDto(LibraryTag t) {
        TagDto dto = new TagDto();
        dto.setId(t.getId());
        dto.setTenantId(t.getTenantId());
        dto.setName(t.getName());
        dto.setColor(t.getColor());
        dto.setResourceCount(t.getResourceCount());
        dto.setCreatedAt(t.getCreatedAt());
        dto.setUpdatedAt(t.getUpdatedAt());
        return dto;
    }

    /** 绑定查询行 → 标签 DTO（无 resourceCount，对齐 Go 绑定查询仅扫标签基础字段） */
    private TagDto toTagDto(TagRelationRow row) {
        TagDto dto = new TagDto();
        dto.setId(row.getTagId());
        dto.setTenantId(row.getTenantId());
        dto.setName(row.getName());
        dto.setColor(row.getColor());
        dto.setCreatedAt(row.getCreatedAt());
        dto.setUpdatedAt(row.getUpdatedAt());
        return dto;
    }

    private List<String> dedupNonEmpty(List<String> ids) {
        if (ids == null) {
            return new ArrayList<>();
        }
        Set<String> seen = new LinkedHashSet<>();
        for (String id : ids) {
            if (id != null && !id.isEmpty()) {
                seen.add(id);
            }
        }
        return new ArrayList<>(seen);
    }

    private void validateName(String name) {
        if (name.isEmpty()) {
            throw new ApiException(400, "bad_request", "标签名称不能为空");
        }
        if (name.codePointCount(0, name.length()) > 64) {
            throw new ApiException(400, "bad_request", "标签名称不能超过 64 个字符");
        }
    }

    private void validateColor(String color) {
        if (!HEX_COLOR.matcher(color).matches()) {
            throw new ApiException(400, "bad_request", "标签颜色格式不正确（示例：#6366f1）");
        }
    }

}
