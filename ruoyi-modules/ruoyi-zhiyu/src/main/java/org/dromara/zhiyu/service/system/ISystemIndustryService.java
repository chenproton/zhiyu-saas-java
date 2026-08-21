package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemIndustry;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.IndustryRequest;

/**
 * 行业服务（对齐 Go industry_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemIndustryService {

    ListResponse<SystemIndustry> list(String search, String parentId, String enabled, long limit, long offset);

    SystemIndustry get(String id);

    SystemIndustry create(IndustryRequest req);

    SystemIndustry update(String id, IndustryRequest req);

    String delete(String id);
}
