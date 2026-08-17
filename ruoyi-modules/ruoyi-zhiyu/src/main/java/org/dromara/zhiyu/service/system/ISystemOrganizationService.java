package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemOrganization;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateOrgRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.OrgTreeNode;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateOrgRequest;

import java.util.List;

/**
 * 组织服务（对齐 Go org_handler.go + service/org.go）。
 *
 * @author zhiyu
 */
public interface ISystemOrganizationService {

    ListResponse<SystemOrganization> list(String typeId, String parentId, String rootOnly, String search,
                                          long limit, long offset);

    List<OrgTreeNode> tree();

    SystemOrganization get(String id);

    SystemOrganization create(CreateOrgRequest req);

    SystemOrganization update(String id, UpdateOrgRequest req);

    String delete(String id);
}
