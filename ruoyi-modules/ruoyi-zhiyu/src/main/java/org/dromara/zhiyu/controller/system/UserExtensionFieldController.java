package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemUserExtensionField;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UserExtensionFieldUpdateRequest;
import org.dromara.zhiyu.service.system.ISystemUserExtensionFieldService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户扩展字段控制器（对齐 Go user_extension_field_handler.go 的 /user-extension-fields 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/user-extension-fields")
public class UserExtensionFieldController {

    private final ISystemUserExtensionFieldService fieldService;

    @GetMapping
    public ListResponse<SystemUserExtensionField> list() {
        List<SystemUserExtensionField> items = fieldService.list();
        return ListResponse.of(items, items.size());
    }

    @PutMapping("/{id}")
    public SystemUserExtensionField update(@PathVariable String id, @RequestBody UserExtensionFieldUpdateRequest req) {
        return fieldService.update(id, req);
    }
}
