package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.system.SystemResourceCode;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.ResourceCodeRequest;
import org.dromara.zhiyu.mapper.system.SystemResourceCodeMapper;
import org.dromara.zhiyu.service.system.ISystemResourceCodeService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 资源编码服务实现（对齐 Go resource_code_handler.go + store/resource_codes.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemResourceCodeServiceImpl implements ISystemResourceCodeService {

    private final SystemResourceCodeMapper resourceCodeMapper;
    private final SystemGuard guard;

    @Override
    public ListResponse<SystemResourceCode> list(String search, String type, long limit, long offset) {
        String tenantId = guard.requireTenant();
        long safeLimit = guard.clampLimit(limit, 50);
        LambdaQueryBuilder<SystemResourceCode> wrapper = QueryBuilder.lambda(SystemResourceCode.class)
            .eq(SystemResourceCode::getTenantId, tenantId);
        if (type != null && !type.isBlank()) {
            wrapper.eq(SystemResourceCode::getType, type);
        }
        if (search != null && !search.isBlank()) {
            wrapper.and(w -> w.like(SystemResourceCode::getName, search).or().like(SystemResourceCode::getCode, search));
        }
        long total = resourceCodeMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SystemResourceCode::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + Math.max(offset, 0));
        List<SystemResourceCode> items = resourceCodeMapper.selectList(wrapper.build());
        return ListResponse.of(items, total);
    }

    @Override
    public SystemResourceCode get(String id) {
        SystemResourceCode code = resourceCodeMapper.selectById(id);
        if (code == null) {
            throw new ApiException(404, "not_found", "资源编码不存在");
        }
        guard.verifyTenantOwnership(code.getTenantId());
        return code;
    }

    @Override
    public SystemResourceCode create(ResourceCodeRequest req) {
        guard.requireManagePortal();
        if (isBlank(req.getTenantId()) || isBlank(req.getCode()) || isBlank(req.getName()) || isBlank(req.getType())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        guard.verifyRequestTenant(req.getTenantId());
        String id = UUID.randomUUID().toString();
        resourceCodeMapper.insertCode(id, req.getTenantId(), req.getCode(), req.getName(), req.getDescription(), req.getType());
        return resourceCodeMapper.selectById(id);
    }

    @Override
    public SystemResourceCode update(String id, ResourceCodeRequest req) {
        guard.requireManagePortal();
        requireOwned(id);
        if (isBlank(req.getName()) || isBlank(req.getType())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        resourceCodeMapper.updateCode(id, req.getName(), req.getDescription(), req.getType());
        return resourceCodeMapper.selectById(id);
    }

    @Override
    public String delete(String id) {
        guard.requireManagePortal();
        requireOwned(id);
        resourceCodeMapper.deleteCode(id);
        return id;
    }

    private SystemResourceCode requireOwned(String id) {
        SystemResourceCode code = resourceCodeMapper.selectById(id);
        if (code == null) {
            throw new ApiException(404, "not_found", "资源编码不存在");
        }
        guard.verifyTenantOwnership(code.getTenantId());
        return code;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

}
