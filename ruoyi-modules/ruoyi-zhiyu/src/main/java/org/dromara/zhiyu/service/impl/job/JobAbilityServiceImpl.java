package org.dromara.zhiyu.service.impl.job;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityPointDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CitationBucketDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.job.JobAbilityPoint;
import org.dromara.zhiyu.mapper.job.JobAbilityPointMapper;
import org.dromara.zhiyu.service.job.IJobAbilityService;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 能力点服务实现（对齐 Go ability_handler.go + store/abilities.go 语义）。
 *
 * <p>关键对齐点：列表租户内可见，支持 search/isPublic/creatorId 过滤；
 * 创建时生成 NL 编码（租户内唯一）；引用统计固定分桶顺序
 * （0次/1-5次/6-10次/11-100次/100次以上）；零引用列表支持创建时段筛选 + 分页。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobAbilityServiceImpl implements IJobAbilityService {

    /** 编码字母表（对齐 Go entityCodeAlphabet） */
    private static final String CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    /** 固定分桶顺序（前端柱状图从左到右） */
    private static final List<String> BUCKET_LABELS =
        List.of("0次", "1-5次", "6-10次", "11-100次", "100次以上");

    private final JobAbilityPointMapper abilityMapper;

    @Override
    public ListResponse<AbilityPointDto> list(String search, String isPublic, String creatorId,
                                              long limit, long offset) {
        requireUser();
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        LambdaQueryBuilder<JobAbilityPoint> wrapper = QueryBuilder.lambda(JobAbilityPoint.class)
            .eq(JobAbilityPoint::getTenantId, tenantId);
        if ("true".equals(isPublic)) {
            wrapper.eq(JobAbilityPoint::getIsPublic, true);
        }
        wrapper.eqIfText(JobAbilityPoint::getCreatorId, creatorId);
        if (search != null && !search.isEmpty()) {
            wrapper.and(w -> w.like(JobAbilityPoint::getName, search)
                .or().like(JobAbilityPoint::getDescription, search));
        }
        long total = abilityMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(JobAbilityPoint::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobAbilityPoint> rows = abilityMapper.selectList(wrapper.build());
        List<AbilityPointDto> items = new ArrayList<>(rows.size());
        for (JobAbilityPoint a : rows) {
            items.add(toDto(a));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public AbilityPointDto get(String id) {
        requireUser();
        String tenantId = requireTenant();
        JobAbilityPoint point = abilityMapper.selectById(id);
        if (point == null) {
            throw new ApiException(404, "not_found", "能力点不存在");
        }
        verifyTenantOwnership(point.getTenantId());
        return toDto(point);
    }

    @Override
    public AbilityPointDto create(AbilityRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (abilityExistsName(tenantId, req.getName())) {
            throw new ApiException(409, "conflict", "能力点名称已存在，请使用其他名称");
        }
        JobAbilityPoint point = new JobAbilityPoint();
        point.setTenantId(tenantId);
        point.setName(req.getName());
        point.setDescription(blankToNull(req.getDescription()));
        point.setAttributes(coalesce(req.getAttributes()));
        point.setIsPublic(req.getIsPublic() == null ? Boolean.FALSE : req.getIsPublic());
        point.setCreatorId(userId);
        point.setCode(generateUniqueCode(tenantId));
        abilityMapper.insert(point);
        return toDto(point);
    }

    @Override
    public AbilityPointDto update(String id, AbilityRequest req) {
        requireUser();
        String tenantId = requireTenant();
        JobAbilityPoint existing = abilityMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "能力点不存在");
        }
        verifyTenantOwnership(existing.getTenantId());
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (abilityExistsName(tenantId, req.getName(), id)) {
            throw new ApiException(409, "conflict", "能力点名称已存在，请使用其他名称");
        }
        JobAbilityPoint update = new JobAbilityPoint();
        update.setId(id);
        update.setName(req.getName());
        update.setDescription(blankToNull(req.getDescription()));
        update.setAttributes(coalesce(req.getAttributes()));
        update.setIsPublic(req.getIsPublic() == null ? Boolean.FALSE : req.getIsPublic());
        abilityMapper.updateById(update);
        return toDto(abilityMapper.selectById(id));
    }

    @Override
    public String delete(String id) {
        requireUser();
        String tenantId = requireTenant();
        JobAbilityPoint existing = abilityMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "能力点不存在");
        }
        verifyTenantOwnership(existing.getTenantId());
        abilityMapper.deleteById(id);
        return id;
    }

    @Override
    public CitationStatsDto citationStats() {
        String tenantId = requireTenant();
        Map<String, Integer> counts = new LinkedHashMap<>();
        int total = 0;
        for (JobAbilityPointMapper.CitationCountRow row : abilityMapper.selectCitationStats(tenantId)) {
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
        long total = abilityMapper.countUncited(tenantId, from, to);
        List<JobAbilityPoint> rows = abilityMapper.selectUncited(tenantId, from, to,
            (int) safeLimit, (int) safeOffset);
        List<UncitedItemDto> items = new ArrayList<>(rows.size());
        for (JobAbilityPoint a : rows) {
            UncitedItemDto item = new UncitedItemDto();
            item.setId(a.getId());
            item.setName(a.getName());
            item.setCreatedAt(a.getCreatedAt());
            items.add(item);
        }
        return ListResponse.of(items, total);
    }

    // ---------- 工具 ----------

    private AbilityPointDto toDto(JobAbilityPoint a) {
        AbilityPointDto dto = new AbilityPointDto();
        dto.setId(a.getId());
        dto.setName(a.getName());
        dto.setCode(a.getCode());
        dto.setDescription(a.getDescription());
        dto.setAttributes(a.getAttributes());
        dto.setIsPublic(a.getIsPublic());
        dto.setCreatorId(a.getCreatorId());
        dto.setCreatedAt(a.getCreatedAt());
        return dto;
    }

    private boolean abilityExistsName(String tenantId, String name) {
        return abilityMapper.selectCount(QueryBuilder.lambda(JobAbilityPoint.class)
            .eq(JobAbilityPoint::getTenantId, tenantId).eq(JobAbilityPoint::getName, name).build()) > 0;
    }

    private boolean abilityExistsName(String tenantId, String name, String excludeId) {
        return abilityMapper.selectCount(QueryBuilder.lambda(JobAbilityPoint.class)
            .eq(JobAbilityPoint::getTenantId, tenantId).eq(JobAbilityPoint::getName, name)
            .ne(JobAbilityPoint::getId, excludeId).build()) > 0;
    }

    /** 生成能力编码（NL-8 位随机，租户内唯一，重试 10 次；对齐 Go GenerateUniqueEntityCode）。 */
    private String generateUniqueCode(String tenantId) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder("NL-");
            for (int j = 0; j < 8; j++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!abilityMapper.existsCode(tenantId, code)) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成能力编码失败");
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

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }
}
