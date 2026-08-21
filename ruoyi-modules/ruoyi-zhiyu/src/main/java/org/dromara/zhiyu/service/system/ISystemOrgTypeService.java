package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemOrgType;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.OrgTypeRequest;

/**
 * 组织类型服务（对齐 Go org_type_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemOrgTypeService {

    ListResponse<SystemOrgType> list(String search, String category, long limit, long offset);

    SystemOrgType get(String id);

    SystemOrgType create(OrgTypeRequest req);

    SystemOrgType update(String id, OrgTypeRequest req);

    String delete(String id);
}
