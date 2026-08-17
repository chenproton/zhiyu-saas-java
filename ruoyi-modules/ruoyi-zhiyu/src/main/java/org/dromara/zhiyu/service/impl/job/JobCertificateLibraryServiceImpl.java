package org.dromara.zhiyu.service.impl.job;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CertificateLibraryItemDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CertificateLibraryRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CitationBucketDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.job.JobCertificateLibraryItem;
import org.dromara.zhiyu.mapper.job.JobCertificateLibraryMapper;
import org.dromara.zhiyu.service.job.IJobCertificateLibraryService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 证书库服务实现（对齐 Go certificate_library_handler.go + store/certificate_library.go 语义）。
 *
 * <p>更新/删除校验租户归属（防跨租户 IDOR）；引用统计固定分桶顺序；
 * 零引用列表支持创建时段筛选 + 分页；创建记录 creatorId。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobCertificateLibraryServiceImpl implements IJobCertificateLibraryService {

    /** 固定分桶顺序（前端柱状图从左到右） */
    private static final List<String> BUCKET_LABELS =
        List.of("0次", "1-5次", "6-10次", "11-100次", "100次以上");

    private final JobCertificateLibraryMapper libraryMapper;

    @Override
    public ListResponse<CertificateLibraryItemDto> list(String search, String creatorId, long limit, long offset) {
        requireUser();
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<JobCertificateLibraryItem> wrapper = QueryBuilder.lambda(JobCertificateLibraryItem.class)
            .eq(JobCertificateLibraryItem::getTenantId, tenantId)
            .eqIfText(JobCertificateLibraryItem::getCreatorId, creatorId);
        if (search != null && !search.isEmpty()) {
            wrapper.and(w -> w.like(JobCertificateLibraryItem::getName, search)
                .or().like(JobCertificateLibraryItem::getDescription, search));
        }
        long total = libraryMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(JobCertificateLibraryItem::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobCertificateLibraryItem> rows = libraryMapper.selectList(wrapper.build());
        List<CertificateLibraryItemDto> items = new ArrayList<>(rows.size());
        for (JobCertificateLibraryItem c : rows) {
            items.add(toDto(c));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public CertificateLibraryItemDto get(String id) {
        requireUser();
        String tenantId = requireTenant();
        JobCertificateLibraryItem item = libraryMapper.selectById(id);
        if (item == null) {
            throw new ApiException(404, "not_found", "证书不存在");
        }
        verifyTenantOwnership(item.getTenantId());
        return toDto(item);
    }

    @Override
    public CertificateLibraryItemDto create(CertificateLibraryRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        JobCertificateLibraryItem item = new JobCertificateLibraryItem();
        item.setTenantId(tenantId);
        item.setName(req.getName());
        item.setUrl(blankToNull(req.getUrl()));
        item.setDescription(blankToNull(req.getDescription()));
        item.setImageUrl(blankToNull(req.getImageUrl()));
        item.setCreatorId(userId);
        libraryMapper.insert(item);
        return toDto(item);
    }

    @Override
    public CertificateLibraryItemDto update(String id, CertificateLibraryRequest req) {
        requireUser();
        String tenantId = requireTenant();
        JobCertificateLibraryItem existing = libraryMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "证书不存在");
        }
        verifyTenantOwnership(existing.getTenantId());
        // 部分更新兜底：未携带字段回退现有值（对齐 Go Update 合并语义）
        String name = req.getName() != null ? req.getName() : existing.getName();
        String url = req.getUrl() != null ? req.getUrl() : existing.getUrl();
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        String imageUrl = req.getImageUrl() != null ? req.getImageUrl() : existing.getImageUrl();
        JobCertificateLibraryItem update = new JobCertificateLibraryItem();
        update.setId(id);
        update.setName(name);
        update.setUrl(blankToNull(url));
        update.setDescription(blankToNull(description));
        update.setImageUrl(blankToNull(imageUrl));
        libraryMapper.updateById(update);
        return toDto(libraryMapper.selectById(id));
    }

    @Override
    public String delete(String id) {
        requireUser();
        String tenantId = requireTenant();
        JobCertificateLibraryItem existing = libraryMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "证书不存在");
        }
        verifyTenantOwnership(existing.getTenantId());
        libraryMapper.deleteById(id);
        return id;
    }

    @Override
    public CitationStatsDto citationStats() {
        String tenantId = requireTenant();
        Map<String, Integer> counts = new LinkedHashMap<>();
        int total = 0;
        for (JobCertificateLibraryMapper.CitationCountRow row : libraryMapper.selectCitationStats(tenantId)) {
            if (row.label != null && row.count != null) {
                counts.put(row.label, row.count);
                total += row.count;
            }
        }
        CitationStatsDto stats = new CitationStatsDto();
        List<CitationBucketDto> buckets = new ArrayList<>(BUCKET_LABELS.size());
        for (String label : BUCKET_LABELS) {
            CitationBucketDto bucket = new CitationBucketDto();
            bucket.setLabel(label);
            bucket.setCount(counts.getOrDefault(label, 0));
            buckets.add(bucket);
        }
        stats.setBuckets(buckets);
        stats.setZeroCount(counts.getOrDefault("0次", 0));
        stats.setTotal(total);
        return stats;
    }

    @Override
    public ListResponse<UncitedItemDto> uncited(String startDate, String endDate, long limit, long offset) {
        String tenantId = requireTenant();
        OffsetDateTime from = parseDate(startDate);
        OffsetDateTime to = parseDate(endDate);
        if (to != null) {
            to = to.plusDays(1);
        }
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        long total = libraryMapper.countUncited(tenantId, from, to);
        List<JobCertificateLibraryItem> rows = libraryMapper.selectUncited(tenantId, from, to,
            (int) safeLimit, (int) safeOffset);
        List<UncitedItemDto> items = new ArrayList<>(rows.size());
        for (JobCertificateLibraryItem c : rows) {
            UncitedItemDto item = new UncitedItemDto();
            item.setId(c.getId());
            item.setName(c.getName());
            item.setCreatedAt(c.getCreatedAt());
            items.add(item);
        }
        return ListResponse.of(items, total);
    }

    // ---------- 工具 ----------

    private CertificateLibraryItemDto toDto(JobCertificateLibraryItem c) {
        CertificateLibraryItemDto dto = new CertificateLibraryItemDto();
        dto.setId(c.getId());
        dto.setTenantId(c.getTenantId());
        dto.setName(c.getName());
        dto.setUrl(c.getUrl());
        dto.setDescription(c.getDescription());
        dto.setImageUrl(c.getImageUrl());
        dto.setCreatorId(c.getCreatorId());
        dto.setCreatedAt(c.getCreatedAt());
        return dto;
    }

    /** 解析 YYYY-MM-DD 为 UTC 起始时刻（空串返回 null；格式非法 400）。 */
    private OffsetDateTime parseDate(String date) {
        if (date == null || date.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(date).atStartOfDay().atOffset(ZoneOffset.UTC);
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "日期格式应为 YYYY-MM-DD");
        }
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

    private void verifyTenantOwnership(String entityTenantId) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (entityTenantId != null && !entityTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
    }

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
