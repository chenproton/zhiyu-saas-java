package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.system.SystemMajor;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.MajorRequest;
import org.dromara.zhiyu.mapper.system.SystemMajorMapper;
import org.dromara.zhiyu.service.system.ISystemMajorService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 专业服务实现（对齐 Go major_handler.go + store/majors.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemMajorServiceImpl implements ISystemMajorService {

    private final SystemMajorMapper majorMapper;
    private final SystemGuard guard;

    @Override
    public ListResponse<SystemMajor> list(String search, String enabled, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = guard.clampLimit(limit, 50);
        LambdaQueryBuilder<SystemMajor> wrapper = QueryBuilder.lambda(SystemMajor.class)
            .eq(SystemMajor::getTenantId, tenantId);
        if (enabled != null && !enabled.isBlank()) {
            wrapper.eq(SystemMajor::getEnabled, "true".equals(enabled));
        }
        if (search != null && !search.isBlank()) {
            wrapper.and(w -> w.like(SystemMajor::getName, search).or().like(SystemMajor::getCode, search));
        }
        long total = majorMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SystemMajor::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<SystemMajor> items = majorMapper.selectList(wrapper.build());
        return ListResponse.of(items, total);
    }

    @Override
    public SystemMajor get(String id) {
        SystemMajor major = majorMapper.selectById(id);
        if (major == null) {
            throw new ApiException(404, "not_found", "专业不存在");
        }
        guard.verifyTenantOwnership(major.getTenantId());
        return major;
    }

    @Override
    public SystemMajor create(MajorRequest req) {
        guard.requireManagePortal();
        if (isBlank(req.getTenantId()) || isBlank(req.getCode()) || isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        guard.verifyRequestTenant(req.getTenantId());
        String id = UUID.randomUUID().toString();
        majorMapper.insertMajor(id, req.getTenantId(), req.getCode(), req.getName(), req.getAlias(), req.getEnabled());
        return majorMapper.selectById(id);
    }

    @Override
    public SystemMajor update(String id, MajorRequest req) {
        guard.requireManagePortal();
        requireOwned(id);
        if (isBlank(req.getCode()) || isBlank(req.getName())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        majorMapper.updateMajor(id, req.getCode(), req.getName(), req.getAlias(), req.getEnabled());
        return majorMapper.selectById(id);
    }

    @Override
    public String delete(String id) {
        guard.requireManagePortal();
        requireOwned(id);
        if (majorMapper.countUserRefs(id) > 0) {
            throw new ApiException(409, "conflict", "该专业下仍有学生，请先将学生调整到其他专业");
        }
        majorMapper.deleteMajor(id);
        return id;
    }

    private SystemMajor requireOwned(String id) {
        SystemMajor major = majorMapper.selectById(id);
        if (major == null) {
            throw new ApiException(404, "not_found", "专业不存在");
        }
        guard.verifyTenantOwnership(major.getTenantId());
        return major;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

}
