package org.dromara.zhiyu.service.impl.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.system.SystemUserExtensionField;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UserExtensionFieldUpdateRequest;
import org.dromara.zhiyu.mapper.system.SystemUserExtensionFieldMapper;
import org.dromara.zhiyu.service.system.ISystemUserExtensionFieldService;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 用户扩展字段服务实现（对齐 Go user_extension_field_handler.go + store/user_extension_fields.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SystemUserExtensionFieldServiceImpl implements ISystemUserExtensionFieldService {

    private final SystemUserExtensionFieldMapper fieldMapper;
    private final SystemGuard guard;

    @Override
    public List<SystemUserExtensionField> list() {
        String tenantId = guard.requireTenant();
        return fieldMapper.selectByTenant(tenantId);
    }

    @Override
    public SystemUserExtensionField update(String id, UserExtensionFieldUpdateRequest req) {
        guard.requireManageUsers();
        String tenantId = guard.requireTenant();
        SystemUserExtensionField existing = fieldMapper.selectByIdAndTenant(id, tenantId);
        if (existing == null) {
            throw new ApiException(404, "not_found", "扩展字段不存在");
        }
        if (req.getFieldName() == null || req.getFieldName().isBlank()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        fieldMapper.updateField(id, tenantId, req.getFieldName(), req.getIsEnabled(), req.getIsRequired(),
            req.getApplicableRoleCodes());
        return fieldMapper.selectByIdAndTenant(id, tenantId);
    }
}
