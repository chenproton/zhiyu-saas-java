package org.dromara.zhiyu.service.impl.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationBucketDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.KnowledgePointDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.KnowledgePointRequest;
import org.dromara.zhiyu.domain.lesson.KnowledgePoint;
import org.dromara.zhiyu.mapper.library.LibraryResourceTagRelationMapper;
import org.dromara.zhiyu.mapper.lesson.KnowledgePointMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.lesson.ILessonKnowledgePointService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 知识点服务实现（对齐 Go knowledge_point_handler.go + store/lesson_content.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LessonKnowledgePointServiceImpl implements ILessonKnowledgePointService {

    private static final List<String> CITATION_BUCKET_LABELS = List.of("0次", "1-5次", "6-10次", "11-100次", "100次以上");

    private final SystemGuard systemGuard;
    private final KnowledgePointMapper knowledgePointMapper;
    private final LibraryResourceTagRelationMapper tagRelationMapper;

    @Override
    public ListResponse<KnowledgePointDto> list(String search, Boolean linked, String creatorId, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        LambdaQueryBuilder<KnowledgePoint> wrapper = QueryBuilder.lambda(KnowledgePoint.class)
            .eq(KnowledgePoint::getTenantId, tenantId);
        if (linked != null) {
            wrapper.eq(KnowledgePoint::getLinked, linked);
        }
        if (creatorId != null && !creatorId.isEmpty()) {
            wrapper.eq(KnowledgePoint::getCreatorId, creatorId);
        }
        if (search != null && !search.isEmpty()) {
            wrapper.and(w -> w.like(KnowledgePoint::getName, search).or().like(KnowledgePoint::getCode, search));
        }
        long total = knowledgePointMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(KnowledgePoint::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<KnowledgePoint> rows = knowledgePointMapper.selectList(wrapper.build());
        return ListResponse.of(rows.stream().map(this::toDto).toList(), total);
    }

    @Override
    public KnowledgePointDto get(String id) {
        systemGuard.requireUser();
        return toDto(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgePointDto create(KnowledgePointRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String id = UUID.randomUUID().toString();
        List<String> granularIds = req.getGranularLessonIds() == null ? List.of() : req.getGranularLessonIds();
        knowledgePointMapper.insertKnowledgePoint(id, tenantId, req.getName(), req.getCode(), req.getDescription(),
            req.getLinked() != null && req.getLinked(), granularIds, userId, req.getSourceType(), req.getSourceId());
        syncCourseKnowledgePoints(tenantId, id, granularIds);
        return toDto(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgePointDto update(String id, KnowledgePointRequest req) {
        systemGuard.requireUser();
        KnowledgePoint existing = fetchOwned(id);
        String tenantId = existing.getTenantId();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String code = req.getCode() != null ? req.getCode() : existing.getCode();
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        boolean linked = req.getLinked() != null ? req.getLinked() : existing.getLinked();
        List<String> granularIds = req.getGranularLessonIds() != null ? req.getGranularLessonIds() : existing.getGranularLessonIds();
        knowledgePointMapper.updateKnowledgePoint(id, tenantId, req.getName(), code, description, linked, granularIds);
        syncCourseKnowledgePoints(tenantId, id, granularIds);
        return toDto(fetchOwned(id));
    }

    @Override
    public String delete(String id) {
        systemGuard.requireUser();
        KnowledgePoint existing = fetchOwned(id);
        tagRelationMapper.deleteByResourceGlobal("knowledge_point", id);
        knowledgePointMapper.deleteKnowledgePoint(id, existing.getTenantId());
        return id;
    }

    @Override
    public CitationStatsDto citationStats() {
        String tenantId = systemGuard.requireTenant();
        List<CitationBucketDto> buckets = knowledgePointMapper.citationBuckets(tenantId);
        Map<String, Integer> counts = new LinkedHashMap<>();
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
    public ListResponse<UncitedItemDto> uncited(String startDate, String endDate, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        OffsetDateTime from = parseDateOrNull(startDate);
        OffsetDateTime to = parseDateEndExclusive(endDate);
        long safeLimit = systemGuard.clampLimit(limit, 20);
        long safeOffset = Math.max(offset, 0);
        long total = knowledgePointMapper.countUncited(tenantId, from, to);
        List<UncitedItemDto> items = knowledgePointMapper.listUncited(tenantId, from, to, (int) safeLimit, (int) safeOffset);
        return ListResponse.of(items, total);
    }

    // ---------- 工具 ----------

    private void syncCourseKnowledgePoints(String tenantId, String kpId, List<String> courseIds) {
        knowledgePointMapper.appendKpToCourses(kpId, tenantId, courseIds);
        knowledgePointMapper.removeKpFromCourses(kpId, tenantId, courseIds);
    }

    private KnowledgePointDto toDto(KnowledgePoint kp) {
        KnowledgePointDto dto = new KnowledgePointDto();
        dto.setId(kp.getId());
        dto.setName(kp.getName());
        dto.setCode(kp.getCode());
        dto.setDescription(kp.getDescription());
        dto.setCategory(kp.getCategory());
        dto.setLinked(kp.getLinked());
        dto.setGranularLessonIds(kp.getGranularLessonIds());
        dto.setCreatorId(kp.getCreatorId());
        dto.setSourceType(kp.getSourceType());
        dto.setSourceId(kp.getSourceId());
        dto.setCreatedAt(kp.getCreatedAt());
        dto.setUpdatedAt(kp.getUpdatedAt());
        return dto;
    }

    private KnowledgePoint fetchOwned(String id) {
        KnowledgePoint kp = knowledgePointMapper.selectById(id);
        if (kp == null) {
            throw new ApiException(404, "not_found", "知识点不存在");
        }
        verifyTenantOwnership(kp.getTenantId());
        return kp;
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

    private OffsetDateTime parseDateOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toOffsetDateTime();
        } catch (DateTimeParseException e) {
            throw new ApiException(400, "bad_request", "日期格式应为 YYYY-MM-DD");
        }
    }

    private OffsetDateTime parseDateEndExclusive(String value) {
        OffsetDateTime parsed = parseDateOrNull(value);
        return parsed == null ? null : parsed.plusDays(1);
    }

}
