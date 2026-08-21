package org.dromara.zhiyu.service.impl.library;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationBucketDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CreateResourceRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.PreviewImportRequest;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceLibraryItemDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceTypeCountDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UpdateResourceRequest;
import org.dromara.zhiyu.domain.library.LibraryResource;
import org.dromara.zhiyu.mapper.library.LibraryResourceMapper;
import org.dromara.zhiyu.mapper.library.LibraryResourceTagRelationMapper;
import org.dromara.zhiyu.service.library.ILibraryResourceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 资源库服务实现（对齐 Go resource_library_handler.go + service/resource.go +
 * store/resource_library.go 语义）。
 *
 * <p>列表默认 limit=50（上限 200）、offset=0；search 按 Go 语义转义 LIKE 通配符
 * （%/_\），日期范围按 YYYY-MM-DD 解析（endDate 含当天，转次日零点开区间）。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LibraryResourceServiceImpl implements ILibraryResourceService {

    /** 列表默认页大小（对齐 Go parseLimitOffset(r, 50)） */
    private static final int DEFAULT_LIMIT = 50;

    /** 引用次数分桶固定顺序（前端柱状图从左到右） */
    private static final List<String> CITATION_BUCKET_LABELS = List.of("0次", "1-5次", "6-10次", "11-100次", "100次以上");

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    private final LibraryResourceMapper resourceMapper;
    private final LibraryResourceTagRelationMapper tagRelationMapper;

    @Override
    public ListResponse<ResourceLibraryItemDto> list(String search, String resourceType, String orgName,
                                                     String majorName, String uploadedBy, String tagIds,
                                                     int limit, int offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, DEFAULT_LIMIT);
        long safeOffset = Math.max(offset, 0);
        String pattern = toLikePattern(search);
        List<String> tagIdList = splitTagIds(tagIds);

        long total = resourceMapper.countResourcePage(tenantId, pattern, resourceType, orgName, majorName,
            uploadedBy, tagIdList);
        List<LibraryResource> rows = resourceMapper.selectResourcePage(tenantId, pattern, resourceType, orgName,
            majorName, uploadedBy, tagIdList, (int) safeLimit, (int) safeOffset);
        List<ResourceLibraryItemDto> items = rows.stream().map(this::toDto).toList();
        return ListResponse.of(items, total);
    }

    @Override
    public ResourceLibraryItemDto get(String id) {
        requireUser();
        LibraryResource item = fetchOwned(id);
        return toDto(item);
    }

    @Override
    public ResourceLibraryItemDto create(CreateResourceRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (req.getName() == null || req.getName().isEmpty()
            || req.getResourceType() == null || req.getResourceType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少名称或资源类型");
        }
        String id = UUID.randomUUID().toString();
        resourceMapper.insertResource(id, tenantId, req.getName(), req.getResourceType(), req.getUrl(),
            req.getDescription(), req.getThumbnail(), req.getFileSize(), toJson(req.getMetadata()), userId);
        LibraryResource created = resourceMapper.selectItemById(id);
        if (created == null) {
            throw new ApiException(500, "internal_error", "创建资源失败");
        }
        return toDto(created);
    }

    @Override
    public ResourceLibraryItemDto update(String id, UpdateResourceRequest req) {
        requireUser();
        LibraryResource existing = fetchOwned(id);
        String name = req.getName() != null ? req.getName() : existing.getName();
        String resourceType = req.getResourceType() != null ? req.getResourceType() : existing.getResourceType();
        String url = req.getUrl() != null ? req.getUrl() : existing.getUrl();
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        String thumbnail = req.getThumbnail() != null ? req.getThumbnail() : existing.getThumbnail();
        Long fileSize = req.getFileSize() != null ? req.getFileSize() : existing.getFileSize();
        String metadata = req.getMetadata() != null ? toJson(req.getMetadata()) : existing.getMetadata();

        resourceMapper.updateResource(id, name, resourceType, url, description, thumbnail, fileSize, metadata);
        LibraryResource updated = resourceMapper.selectItemById(id);
        if (updated == null) {
            throw new ApiException(500, "internal_error", "更新资源失败");
        }
        return toDto(updated);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        requireUser();
        fetchOwned(id);
        tagRelationMapper.deleteByResourceGlobal("resource_library", id);
        resourceMapper.deleteResource(id);
        return id;
    }

    @Override
    public List<ResourceTypeCountDto> stats(String search) {
        String tenantId = requireTenant();
        return resourceMapper.countByType(tenantId, toLikePattern(search));
    }

    @Override
    public CitationStatsDto citationStats(String resourceType) {
        String tenantId = requireTenant();
        List<CitationBucketDto> buckets = resourceMapper.citationBuckets(tenantId, resourceType);
        Map<String, Integer> counts = new java.util.HashMap<>();
        int total = 0;
        for (CitationBucketDto b : buckets) {
            int cnt = b.getCount() == null ? 0 : b.getCount();
            counts.put(b.getLabel(), cnt);
            total += cnt;
        }
        List<CitationBucketDto> ordered = new ArrayList<>(CITATION_BUCKET_LABELS.size());
        for (String label : CITATION_BUCKET_LABELS) {
            CitationBucketDto bucket = new CitationBucketDto();
            bucket.setLabel(label);
            bucket.setCount(counts.getOrDefault(label, 0));
            ordered.add(bucket);
        }
        CitationStatsDto stats = new CitationStatsDto();
        stats.setBuckets(ordered);
        stats.setZeroCount(counts.getOrDefault("0次", 0));
        stats.setTotal(total);
        return stats;
    }

    @Override
    public ListResponse<UncitedItemDto> uncited(String resourceType, String startDate, String endDate,
                                                int limit, int offset) {
        String tenantId = requireTenant();
        OffsetDateTime from = parseDateOrNull(startDate);
        OffsetDateTime to = parseDateEndExclusive(endDate);
        long safeLimit = clampLimit(limit, 20);
        long safeOffset = Math.max(offset, 0);

        long total = resourceMapper.countUncited(tenantId, resourceType, from, to);
        List<UncitedItemDto> items = resourceMapper.listUncited(tenantId, resourceType, from, to,
            (int) safeLimit, (int) safeOffset);
        return ListResponse.of(items, total);
    }

    @Override
    public ListResponse<ResourceLibraryItemDto> previewImport(PreviewImportRequest req) {
        String tenantId = requireTenant();
        if (req.getNames() == null || req.getNames().isEmpty()
            || req.getResourceType() == null || req.getResourceType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少名称或资源类型");
        }
        List<LibraryResource> rows = resourceMapper.selectByNames(tenantId, req.getResourceType(), req.getNames());
        List<ResourceLibraryItemDto> items = rows.stream().map(this::toDto).toList();
        return ListResponse.of(items, items.size());
    }

    // ---------- 组装/工具 ----------

    private LibraryResource fetchOwned(String id) {
        LibraryResource item = resourceMapper.selectItemById(id);
        if (item == null) {
            throw new ApiException(404, "not_found", "资源不存在");
        }
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (!tenantId.equals(item.getTenantId())) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
        return item;
    }

    private ResourceLibraryItemDto toDto(LibraryResource r) {
        ResourceLibraryItemDto dto = new ResourceLibraryItemDto();
        dto.setId(r.getId());
        dto.setTenantId(r.getTenantId());
        dto.setName(r.getName());
        dto.setResourceType(r.getResourceType());
        dto.setUrl(r.getUrl());
        dto.setDescription(r.getDescription());
        dto.setThumbnail(r.getThumbnail());
        dto.setFileSize(r.getFileSize());
        dto.setMetadata(fromJson(r.getMetadata()));
        dto.setUploadedBy(r.getUploadedBy());
        dto.setUploaderName(r.getUploaderName());
        dto.setUploaderOrgName(r.getUploaderOrgName());
        dto.setUploaderMajorName(r.getUploaderMajorName());
        dto.setCreatedAt(r.getCreatedAt());
        dto.setUpdatedAt(r.getUpdatedAt());
        return dto;
    }

    /** 转义 LIKE 通配符并包裹 %pattern%（对齐 Go strings.NewReplacer 语义） */
    private String toLikePattern(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        String escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    /** 解析逗号分隔 tagIds 为去重后的列表（对齐 Go SplitTagIDs） */
    private List<String> splitTagIds(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        Set<String> seen = new LinkedHashSet<>();
        for (String part : raw.split(",")) {
            String p = part.trim();
            if (!p.isEmpty()) {
                seen.add(p);
            }
        }
        return new ArrayList<>(seen);
    }

    /** 解析 YYYY-MM-DD 为 UTC 零点（对齐 Go time.Parse "2006-01-02" 语义）；非法输入 400 */
    private OffsetDateTime parseDateOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value, DATE_FORMAT).atStartOfDay(ZoneOffset.UTC).toOffsetDateTime();
        } catch (DateTimeParseException e) {
            throw new ApiException(400, "bad_request", "日期格式应为 YYYY-MM-DD");
        }
    }

    /** endDate 含当天：解析后 +1 天（次日零点开区间） */
    private OffsetDateTime parseDateEndExclusive(String value) {
        OffsetDateTime parsed = parseDateOrNull(value);
        return parsed == null ? null : parsed.plusDays(1);
    }

    /** metadata Map → jsonb JSON 文本（null 时默认 "{}" 对齐 Go JSONMap） */
    private String toJson(Map<String, Object> metadata) {
        try {
            return MAPPER.writeValueAsString(metadata == null ? Map.of() : metadata);
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "元数据格式不正确");
        }
    }

    /** jsonb JSON 文本 → Map（空串/非法返回 null，省略字段） */
    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, MAP_REF);
        } catch (Exception e) {
            return null;
        }
    }

    private long clampLimit(int limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }
}
