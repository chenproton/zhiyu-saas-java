package org.dromara.zhiyu.service.impl.job;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionRecommendationDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.RecommendRequest;
import org.dromara.zhiyu.domain.job.JobRecommendation;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.mapper.job.JobCareerPositionMapper;
import org.dromara.zhiyu.mapper.job.JobRecommendationMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.service.job.IJobRecommendService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 岗位推荐服务实现（对齐 Go recommend_handler.go + store/recommends.go 语义）。
 *
 * <p>推荐位无独立租户字段归属问题（tenant_id 列即归属），列表/详情/写操作全部租户限定；
 * 创建/更新校验推荐岗位属于当前租户（防跨租户引用）。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobRecommendServiceImpl implements IJobRecommendService {

    private final JobRecommendationMapper recommendMapper;
    private final JobCareerPositionMapper positionMapper;
    private final PortalMajorMapper majorMapper;

    @Override
    public ListResponse<PositionRecommendationDto> list(String majorId, String careerPositionId,
                                                        long limit, long offset) {
        requireUser();
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<JobRecommendation> wrapper = QueryBuilder.lambda(JobRecommendation.class)
            .eq(JobRecommendation::getTenantId, tenantId)
            .eqIfText(JobRecommendation::getMajorId, majorId)
            .eqIfText(JobRecommendation::getCareerPositionId, careerPositionId);
        long total = recommendMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(JobRecommendation::getSortOrder)
            .orderByDesc(JobRecommendation::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobRecommendation> rows = recommendMapper.selectList(wrapper.build());
        List<PositionRecommendationDto> items = new ArrayList<>(rows.size());
        for (JobRecommendation r : rows) {
            items.add(toDto(r, resolveMajorName(r.getMajorId(), tenantId)));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public PositionRecommendationDto get(String id) {
        requireUser();
        String tenantId = requireTenant();
        JobRecommendation rec = recommendMapper.selectRecommendById(id, tenantId);
        if (rec == null) {
            throw new ApiException(404, "not_found", "推荐不存在");
        }
        return toDto(rec, resolveMajorName(rec.getMajorId(), tenantId));
    }

    @Override
    public PositionRecommendationDto create(RecommendRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()
            || req.getPositionType() == null || req.getPositionType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 推荐岗位必须属于当前租户
        checkPositionTenant(req.getCareerPositionId(), tenantId);
        JobRecommendation rec = new JobRecommendation();
        rec.setTenantId(tenantId);
        rec.setMajorId(emptyToNull(req.getMajorId()));
        rec.setCareerPositionId(req.getCareerPositionId());
        rec.setPositionType(req.getPositionType());
        rec.setReason(emptyToNull(req.getReason()));
        rec.setSortOrder(req.getSortOrder() == null ? 0 : req.getSortOrder());
        rec.setIsEnabled(req.getIsEnabled() == null ? Boolean.TRUE : req.getIsEnabled());
        rec.setCreatedBy(userId);
        recommendMapper.insert(rec);
        return toDto(rec, resolveMajorName(rec.getMajorId(), tenantId));
    }

    @Override
    public PositionRecommendationDto update(String id, RecommendRequest req) {
        requireUser();
        String tenantId = requireTenant();
        JobRecommendation existing = recommendMapper.selectRecommendById(id, tenantId);
        if (existing == null) {
            throw new ApiException(404, "not_found", "推荐不存在");
        }
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()
            || req.getPositionType() == null || req.getPositionType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        checkPositionTenant(req.getCareerPositionId(), tenantId);
        recommendMapper.updateRecommend(id, tenantId, emptyToNull(req.getMajorId()), req.getCareerPositionId(),
            req.getPositionType(), emptyToNull(req.getReason()),
            req.getSortOrder() == null ? 0 : req.getSortOrder(),
            req.getIsEnabled() == null ? Boolean.TRUE : req.getIsEnabled());
        JobRecommendation updated = recommendMapper.selectRecommendById(id, tenantId);
        return toDto(updated, resolveMajorName(updated.getMajorId(), tenantId));
    }

    @Override
    public String delete(String id) {
        requireUser();
        String tenantId = requireTenant();
        JobRecommendation existing = recommendMapper.selectRecommendById(id, tenantId);
        if (existing == null) {
            throw new ApiException(404, "not_found", "推荐不存在");
        }
        recommendMapper.deleteRecommend(id, tenantId);
        return id;
    }

    // ---------- 工具 ----------

    private void checkPositionTenant(String careerPositionId, String tenantId) {
        String posTenant = positionMapper.selectTenantId(careerPositionId);
        if (posTenant == null || !posTenant.equals(tenantId)) {
            throw new ApiException(404, "not_found", "推荐不存在");
        }
    }

    /** 专业名称查询（JOIN majors 语义；查询失败静默返回空串，对齐 Go COALESCE）。 */
    private String resolveMajorName(String majorId, String tenantId) {
        if (majorId == null || majorId.isEmpty()) {
            return null;
        }
        try {
            List<PortalMajor> majors = majorMapper.selectList(
                QueryBuilder.lambda(PortalMajor.class)
                    .eq(PortalMajor::getId, majorId).build());
            return majors.isEmpty() ? null : majors.get(0).getName();
        } catch (Exception e) {
            return null;
        }
    }

    private PositionRecommendationDto toDto(JobRecommendation r, String majorName) {
        PositionRecommendationDto dto = new PositionRecommendationDto();
        dto.setId(r.getId());
        dto.setMajorId(r.getMajorId());
        dto.setMajorName(majorName != null ? majorName : r.getMajorName());
        dto.setCareerPositionId(r.getCareerPositionId());
        dto.setPositionType(r.getPositionType());
        dto.setReason(r.getReason());
        dto.setSortOrder(r.getSortOrder());
        dto.setIsEnabled(r.getIsEnabled());
        dto.setCreatedBy(r.getCreatedBy());
        dto.setCreatedAt(r.getCreatedAt());
        dto.setUpdatedAt(r.getUpdatedAt());
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

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }
}
