package org.dromara.zhiyu.service.portal;

import org.dromara.zhiyu.domain.dto.AuthDtos.ZhiyuUserView;
import org.dromara.zhiyu.domain.dto.portal.UserSelfDtos.ChangeMyPasswordRequest;
import org.dromara.zhiyu.domain.dto.portal.UserSelfDtos.UpdateMeRequest;

/**
 * 个人中心自助修改服务（对齐 Go user_management_handler.go UpdateMe/ChangeMyPassword）。
 *
 * @author zhiyu
 */
public interface IUserSelfService {

    /**
     * 修改本人姓名（仅允许修改当前登录用户自身）。
     *
     * @param req 姓名请求
     * @return 更新后的用户信息
     */
    ZhiyuUserView updateMe(UpdateMeRequest req);

    /**
     * 修改本人密码（无需校验旧密码）。
     *
     * @param req 新密码请求
     * @return 当前用户 ID
     */
    String changeMyPassword(ChangeMyPasswordRequest req);
}
