package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateUserRelationRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UserRelationItem;

/**
 * 用户关系服务（对齐 Go user_relation_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemUserRelationService {

    ListResponse<UserRelationItem> list(String search, long limit, long offset);

    String create(CreateUserRelationRequest req);

    String delete(String id);
}
