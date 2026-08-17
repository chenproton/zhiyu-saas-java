package org.dromara.zhiyu.domain.dto.portal;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 个人中心自助修改 DTO（对齐 Go user_management_handler.go UpdateMeRequest/ChangeMyPasswordRequest）。
 *
 * @author zhiyu
 */
public class UserSelfDtos {

    /** 修改本人姓名请求 */
    @Data
    public static class UpdateMeRequest {
        @NotBlank(message = "姓名不能为空")
        private String name;
    }

    /** 修改本人密码请求（无需旧密码） */
    @Data
    public static class ChangeMyPasswordRequest {
        @NotBlank(message = "密码不能为空")
        private String newPassword;
    }
}
