package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemResourceCode;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.ResourceCodeRequest;

/**
 * 资源编码服务（对齐 Go resource_code_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemResourceCodeService {

    ListResponse<SystemResourceCode> list(String search, String type, long limit, long offset);

    SystemResourceCode get(String id);

    SystemResourceCode create(ResourceCodeRequest req);

    SystemResourceCode update(String id, ResourceCodeRequest req);

    String delete(String id);
}
