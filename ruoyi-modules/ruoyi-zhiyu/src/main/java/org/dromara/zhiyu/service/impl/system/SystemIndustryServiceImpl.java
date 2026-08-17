package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.system.SystemIndustry;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.IndustryRequest;
import org.dromara.zhiyu.mapper.system.SystemIndustryMapper;
import org.dromara.zhiyu.service.system.ISystemIndustryService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 行业服务实现（对齐 Go industry_handler.go + store/industries.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemIndustryServiceImpl implements ISystemIndustryService {

    private final SystemIndustryMapper industryMapper;
    private final SystemGuard guard;

    @Override
    public ListResponse<SystemIndustry> list(String search, String parentId, String enabled, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = clampLimit(limit, 50);
        LambdaQueryBuilder<SystemIndustry> wrapper = QueryBuilder.lambda(SystemIndustry.class)
            .eq(SystemIndustry::getTenantId, tenantId);
        if (parentId != null && !parentId.isBlank()) {
            wrapper.eq(SystemIndustry::getParentId, parentId);
        }
        if (enabled != null && !enabled.isBlank()) {
            wrapper.eq(SystemIndustry::getEnabled, "true".equals(enabled));
        }
        if (search != null && !search.isBlank()) {
            wrapper.and(w -> w.like(SystemIndustry::getName, search).or().like(SystemIndustry::getCode, search));
        }
        long total = industryMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(SystemIndustry::getSortOrder).orderByDesc(SystemIndustry::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<SystemIndustry> items = industryMapper.selectList(wrapper.build());
        return ListResponse.of(items, total);
    }

    @Override
    public SystemIndustry get(String id) {
        SystemIndustry industry = industryMapper.selectById(id);
        if (industry == null) {
            throw new ApiException(404, "not_found", "行业不存在");
        }
        guard.verifyTenantOwnership(industry.getTenantId());
        return industry;
    }

    @Override
    public SystemIndustry create(IndustryRequest req) {
        guard.requireManagePortal();
        if (isBlank(req.getTenantId()) || isBlank(req.getCode()) || isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        guard.verifyRequestTenant(req.getTenantId());
        String id = UUID.randomUUID().toString();
        industryMapper.insertIndustry(id, req.getTenantId(), req.getCode(), req.getName(), req.getParentId(),
            req.getEnabled(), req.getSortOrder() == null ? 0 : req.getSortOrder());
        return industryMapper.selectById(id);
    }

    @Override
    public SystemIndustry update(String id, IndustryRequest req) {
        guard.requireManagePortal();
        requireOwned(id);
        if (isBlank(req.getCode()) || isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        industryMapper.updateIndustry(id, req.getCode(), req.getName(), req.getParentId(), req.getEnabled(),
            req.getSortOrder() == null ? 0 : req.getSortOrder());
        return industryMapper.selectById(id);
    }

    @Override
    public String delete(String id) {
        guard.requireManagePortal();
        requireOwned(id);
        if (industryMapper.countChildren(id) > 0) {
            throw new ApiException(409, "conflict", "该行业下仍有子行业，请先删除子行业");
        }
        industryMapper.deleteIndustry(id);
        return id;
    }

    private SystemIndustry requireOwned(String id) {
        SystemIndustry industry = industryMapper.selectById(id);
        if (industry == null) {
            throw new ApiException(404, "not_found", "行业不存在");
        }
        guard.verifyTenantOwnership(industry.getTenantId());
        return industry;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }
}
