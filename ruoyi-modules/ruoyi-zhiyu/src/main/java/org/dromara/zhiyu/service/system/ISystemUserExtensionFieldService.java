package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.domain.system.SystemUserExtensionField;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UserExtensionFieldUpdateRequest;

import java.util.List;

/**
 * 用户扩展字段服务（对齐 Go user_extension_field_handler.go）。
 *
 * @author zhiyu
 */
public interface ISystemUserExtensionFieldService {

    List<SystemUserExtensionField> list();

    SystemUserExtensionField update(String id, UserExtensionFieldUpdateRequest req);
}
