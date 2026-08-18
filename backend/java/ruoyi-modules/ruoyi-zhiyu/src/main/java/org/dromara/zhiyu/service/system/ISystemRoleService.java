package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemRole;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.RoleRequest;

/**
 * 角色服务（对齐 Go role_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemRoleService {

    ListResponse<SystemRole> list(String search, String status, long limit, long offset);

    SystemRole get(String id);

    SystemRole create(RoleRequest req);

    SystemRole update(String id, RoleRequest req);

    String delete(String id);

    String assign(String id, String userId);
}
