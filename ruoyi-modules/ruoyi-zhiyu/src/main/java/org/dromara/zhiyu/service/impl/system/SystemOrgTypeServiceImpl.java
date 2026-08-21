package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.system.SystemOrgType;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.OrgTypeRequest;
import org.dromara.zhiyu.mapper.system.SystemOrgTypeMapper;
import org.dromara.zhiyu.service.system.ISystemOrgTypeService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 组织类型服务实现（对齐 Go org_type_handler.go + store/org_types.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemOrgTypeServiceImpl implements ISystemOrgTypeService {

    private final SystemOrgTypeMapper orgTypeMapper;
    private final SystemGuard guard;

    @Override
    public ListResponse<SystemOrgType> list(String search, String category, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = clampLimit(limit, 50);
        LambdaQueryBuilder<SystemOrgType> wrapper = QueryBuilder.lambda(SystemOrgType.class)
            .eq(SystemOrgType::getTenantId, tenantId);
        if (category != null && !category.isBlank()) {
            wrapper.eq(SystemOrgType::getCategory, category);
        }
        if (search != null && !search.isBlank()) {
            wrapper.like(SystemOrgType::getName, search);
        }
        long total = orgTypeMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SystemOrgType::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<SystemOrgType> items = orgTypeMapper.selectList(wrapper.build());
        return ListResponse.of(items, total);
    }

    @Override
    public SystemOrgType get(String id) {
        SystemOrgType orgType = orgTypeMapper.selectById(id);
        if (orgType == null) {
            throw new ApiException(404, "not_found", "组织类型不存在");
        }
        guard.verifyTenantOwnership(orgType.getTenantId());
        return orgType;
    }

    @Override
    public SystemOrgType create(OrgTypeRequest req) {
        guard.requireManagePortal();
        if (isBlank(req.getTenantId()) || isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        guard.verifyRequestTenant(req.getTenantId());
        String category = isBlank(req.getCategory()) ? "internal" : req.getCategory();
        if (!isValidCategory(category)) {
            throw new ApiException(400, "bad_request", "无效分类");
        }
        String id = UUID.randomUUID().toString();
        orgTypeMapper.insertOrgType(id, req.getTenantId(), req.getName(), category, req.getDescription());
        return orgTypeMapper.selectById(id);
    }

    @Override
    public SystemOrgType update(String id, OrgTypeRequest req) {
        guard.requireManagePortal();
        requireOwned(id);
        if (isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (!isValidCategory(req.getCategory())) {
            throw new ApiException(400, "bad_request", "无效分类");
        }
        orgTypeMapper.updateOrgType(id, req.getName(), req.getCategory(), req.getDescription());
        return orgTypeMapper.selectById(id);
    }

    @Override
    public String delete(String id) {
        guard.requireManagePortal();
        SystemOrgType existing = requireOwned(id);
        if (Boolean.TRUE.equals(existing.getIsDefault())) {
            throw new ApiException(409, "conflict", "系统默认组织类型不可删除");
        }
        if (orgTypeMapper.countOrgRefs(id) > 0) {
            throw new ApiException(409, "conflict", "该组织类型仍被组织使用，不可删除");
        }
        orgTypeMapper.deleteOrgType(id);
        return id;
    }

    private SystemOrgType requireOwned(String id) {
        SystemOrgType orgType = orgTypeMapper.selectById(id);
        if (orgType == null) {
            throw new ApiException(404, "not_found", "组织类型不存在");
        }
        guard.verifyTenantOwnership(orgType.getTenantId());
        return orgType;
    }

    private boolean isValidCategory(String category) {
        return "internal".equals(category) || "business".equals(category) || "external".equals(category);
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
