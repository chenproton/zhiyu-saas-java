package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemStaffTitle;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.StaffTitleRequest;

/**
 * 职称服务（对齐 Go staff_title_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemStaffTitleService {

    ListResponse<SystemStaffTitle> list(String search, long limit, long offset);

    SystemStaffTitle get(String id);

    SystemStaffTitle create(StaffTitleRequest req);

    SystemStaffTitle update(String id, StaffTitleRequest req);

    String delete(String id);

    SystemStaffTitle toggleStatus(String id, String status);
}
