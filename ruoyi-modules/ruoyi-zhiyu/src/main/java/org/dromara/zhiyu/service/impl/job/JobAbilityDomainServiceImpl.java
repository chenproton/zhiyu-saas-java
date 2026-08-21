package org.dromara.zhiyu.service.impl.job;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.util.ZhiyuStringUtils;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityDomainDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityDomainRequest;
import org.dromara.zhiyu.domain.job.JobAbilityDomain;
import org.dromara.zhiyu.mapper.job.JobAbilityDomainMapper;
import org.dromara.zhiyu.mapper.job.JobCareerPositionMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.job.IJobAbilityDomainService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 能力域服务实现（对齐 Go ability_domain_handler.go + store/ability_domains.go 语义）。
 *
 * <p>列表按 sort_order 升序；创建/更新校验岗位归属当前租户（防跨租户写）；
 * 详情读取校验租户归属（防跨租户 IDOR）。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobAbilityDomainServiceImpl implements IJobAbilityDomainService {

    private final SystemGuard systemGuard;
    private final JobAbilityDomainMapper domainMapper;
    private final JobCareerPositionMapper positionMapper;

    @Override
    public ListResponse<AbilityDomainDto> list(String careerPositionId, long limit, long offset) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<JobAbilityDomain> wrapper = QueryBuilder.lambda(JobAbilityDomain.class)
            .eq(JobAbilityDomain::getTenantId, tenantId)
            .eqIfText(JobAbilityDomain::getCareerPositionId, careerPositionId);
        long total = domainMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(JobAbilityDomain::getSortOrder)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobAbilityDomain> rows = domainMapper.selectList(wrapper.build());
        List<AbilityDomainDto> items = new ArrayList<>(rows.size());
        for (JobAbilityDomain d : rows) {
            items.add(toDto(d));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public AbilityDomainDto get(String id) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobAbilityDomain domain = domainMapper.selectById(id);
        if (domain == null) {
            throw new ApiException(404, "not_found", "能力域不存在");
        }
        verifyTenantOwnership(domain.getTenantId());
        return toDto(domain);
    }

    @Override
    public AbilityDomainDto create(AbilityDomainRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 校验岗位归属当前租户
        checkPositionTenant(req.getCareerPositionId(), tenantId);
        JobAbilityDomain domain = new JobAbilityDomain();
        domain.setTenantId(tenantId);
        domain.setCareerPositionId(req.getCareerPositionId());
        domain.setName(req.getName());
        domain.setDescription(ZhiyuStringUtils.blankToNull(req.getDescription()));
        domain.setBindingIds(coalesce(req.getBindingIds()));
        domain.setSortOrder(req.getSortOrder() == null ? 0 : req.getSortOrder());
        domainMapper.insert(domain);
        return toDto(domain);
    }

    @Override
    public AbilityDomainDto update(String id, AbilityDomainRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobAbilityDomain existing = domainMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "能力域不存在");
        }
        verifyTenantOwnership(existing.getTenantId());
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 校验改绑的目标岗位同样属于当前租户
        checkPositionTenant(req.getCareerPositionId(), tenantId);
        JobAbilityDomain update = new JobAbilityDomain();
        update.setId(id);
        update.setCareerPositionId(req.getCareerPositionId());
        update.setName(req.getName());
        update.setDescription(ZhiyuStringUtils.blankToNull(req.getDescription()));
        update.setBindingIds(coalesce(req.getBindingIds()));
        update.setSortOrder(req.getSortOrder() == null ? 0 : req.getSortOrder());
        domainMapper.updateById(update);
        return toDto(domainMapper.selectById(id));
    }

    @Override
    public String delete(String id) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobAbilityDomain existing = domainMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "能力域不存在");
        }
        verifyTenantOwnership(existing.getTenantId());
        domainMapper.deleteById(id);
        return id;
    }

    // ---------- 工具 ----------

    private void checkPositionTenant(String careerPositionId, String tenantId) {
        String posTenant = positionMapper.selectTenantId(careerPositionId);
        if (posTenant == null || !posTenant.equals(tenantId)) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
    }

    private AbilityDomainDto toDto(JobAbilityDomain d) {
        AbilityDomainDto dto = new AbilityDomainDto();
        dto.setId(d.getId());
        dto.setCareerPositionId(d.getCareerPositionId());
        dto.setName(d.getName());
        dto.setDescription(d.getDescription());
        dto.setBindingIds(d.getBindingIds());
        dto.setSortOrder(d.getSortOrder());
        return dto;
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

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }
}
