package org.dromara.zhiyu.service.impl.job;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.BannerRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.JobBannerConfigDto;
import org.dromara.zhiyu.domain.job.JobBannerConfig;
import org.dromara.zhiyu.mapper.job.JobBannerMapper;
import org.dromara.zhiyu.service.job.IJobBannerService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 岗位轮播图服务实现（对齐 Go job_banner_handler.go + store/banners.go 语义）。
 *
 * <p>部分更新兜底：未携带的排序/开关回退现有值；列表按 sort_order 升序 + 创建时间倒序。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobBannerServiceImpl implements IJobBannerService {

    private final JobBannerMapper bannerMapper;

    @Override
    public ListResponse<JobBannerConfigDto> list(String isEnabled, long limit, long offset) {
        requireUser();
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<JobBannerConfig> wrapper = QueryBuilder.lambda(JobBannerConfig.class)
            .eq(JobBannerConfig::getTenantId, tenantId);
        if (isEnabled != null && !isEnabled.isEmpty()) {
            wrapper.eq(JobBannerConfig::getIsEnabled, "true".equals(isEnabled));
        }
        long total = bannerMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(JobBannerConfig::getSortOrder)
            .orderByDesc(JobBannerConfig::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobBannerConfig> rows = bannerMapper.selectList(wrapper.build());
        List<JobBannerConfigDto> items = new ArrayList<>(rows.size());
        for (JobBannerConfig b : rows) {
            items.add(toDto(b));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public JobBannerConfigDto get(String id) {
        requireUser();
        JobBannerConfig banner = fetchOwned(id);
        return toDto(banner);
    }

    @Override
    public JobBannerConfigDto create(BannerRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getTitle() == null || req.getTitle().isEmpty()
            || req.getImageUrl() == null || req.getImageUrl().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        JobBannerConfig banner = new JobBannerConfig();
        banner.setTenantId(tenantId);
        banner.setTitle(req.getTitle());
        banner.setImageUrl(req.getImageUrl());
        banner.setLinkUrl(blankToNull(req.getLinkUrl()));
        banner.setSortOrder(req.getSortOrder() == null ? 0 : req.getSortOrder());
        banner.setIsEnabled(req.getIsEnabled() == null ? Boolean.TRUE : req.getIsEnabled());
        bannerMapper.insert(banner);
        return toDto(banner);
    }

    @Override
    public JobBannerConfigDto update(String id, BannerRequest req) {
        requireUser();
        JobBannerConfig existing = fetchOwned(id);
        if (req.getTitle() == null || req.getTitle().isEmpty()
            || req.getImageUrl() == null || req.getImageUrl().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 部分更新兜底：未携带的排序/开关回退现有值
        int sortOrder = req.getSortOrder() != null ? req.getSortOrder()
            : (existing.getSortOrder() == null ? 0 : existing.getSortOrder());
        boolean isEnabled = req.getIsEnabled() != null ? req.getIsEnabled()
            : (existing.getIsEnabled() == null || existing.getIsEnabled());
        String linkUrl = req.getLinkUrl() != null ? req.getLinkUrl() : existing.getLinkUrl();
        bannerMapper.updateBanner(id, existing.getTenantId(), req.getTitle(), req.getImageUrl(),
            blankToNull(linkUrl), sortOrder, isEnabled);
        JobBannerConfig updated = bannerMapper.selectById(id);
        return toDto(updated);
    }

    @Override
    public String delete(String id) {
        requireUser();
        JobBannerConfig existing = fetchOwned(id);
        bannerMapper.deleteBanner(id, existing.getTenantId());
        return id;
    }

    // ---------- 工具 ----------

    private JobBannerConfig fetchOwned(String id) {
        JobBannerConfig banner = bannerMapper.selectById(id);
        if (banner == null) {
            throw new ApiException(404, "not_found", "轮播图不存在");
        }
        verifyTenantOwnership(banner.getTenantId());
        return banner;
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

    private JobBannerConfigDto toDto(JobBannerConfig b) {
        JobBannerConfigDto dto = new JobBannerConfigDto();
        dto.setId(b.getId());
        dto.setTitle(b.getTitle());
        dto.setImageUrl(b.getImageUrl());
        dto.setLinkUrl(b.getLinkUrl());
        dto.setSortOrder(b.getSortOrder());
        dto.setIsEnabled(b.getIsEnabled());
        dto.setCreatedAt(b.getCreatedAt());
        dto.setUpdatedAt(b.getUpdatedAt());
        return dto;
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
