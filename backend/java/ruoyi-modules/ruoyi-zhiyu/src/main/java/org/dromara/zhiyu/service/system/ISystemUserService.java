package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateUserRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateUserRequest;

import java.util.List;

/**
 * 系统用户管理服务（对齐 Go user_management_handler.go + service/user.go）。
 *
 * @author zhiyu
 */
public interface ISystemUserService {

    ListResponse<ZhiyuUser> list(String institutionId, String roleId, String roleCode, String orgNodeId,
                                 String titleId, String status, String search, long limit, long offset);

    ZhiyuUser get(String id);

    ZhiyuUser create(CreateUserRequest req);

    ZhiyuUser update(String id, UpdateUserRequest req);

    String delete(String id);

    ZhiyuUser updateStatus(String id, String status);

    ZhiyuUser resetPassword(String id, String password);

    ListResponse<ZhiyuUser> batchCreate(List<CreateUserRequest> users);

    long batchGraduate(List<String> userIds, Integer graduateYear);

    long batchDelete(List<String> userIds);

    long batchUpdateOrgNode(List<String> userIds, String orgNodeId);

    ZhiyuUser bindRoles(String id, List<String> roleIds);
}
