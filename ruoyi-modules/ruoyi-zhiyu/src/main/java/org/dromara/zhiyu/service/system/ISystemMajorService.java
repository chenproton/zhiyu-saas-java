package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemMajor;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.MajorRequest;

/**
 * 专业服务（对齐 Go major_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemMajorService {

    ListResponse<SystemMajor> list(String search, String enabled, long limit, long offset);

    SystemMajor get(String id);

    SystemMajor create(MajorRequest req);

    SystemMajor update(String id, MajorRequest req);

    String delete(String id);
}
