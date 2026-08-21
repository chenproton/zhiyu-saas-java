package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.BatchCreateUserRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.BatchDeleteUsersRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.BatchGraduateRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.BatchUpdateOrgNodeRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.BindUserRolesRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateUserRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.ResetPasswordRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateUserRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateUserStatusRequest;
import org.dromara.zhiyu.service.system.ISystemUserService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 用户管理控制器（对齐 Go user_management_handler.go 的 /users 路由组，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final ISystemUserService userService;

    @GetMapping
    public ListResponse<ZhiyuUser> list(@RequestParam(value = "institutionId", required = false) String institutionId,
                                        @RequestParam(value = "roleId", required = false) String roleId,
                                        @RequestParam(value = "roleCode", required = false) String roleCode,
                                        @RequestParam(value = "orgNodeId", required = false) String orgNodeId,
                                        @RequestParam(value = "titleId", required = false) String titleId,
                                        @RequestParam(value = "status", required = false) String status,
                                        @RequestParam(value = "search", required = false) String search,
                                        @RequestParam(value = "limit", required = false) Long limit,
                                        @RequestParam(value = "offset", required = false) Long offset) {
        return userService.list(institutionId, roleId, roleCode, orgNodeId, titleId, status, search,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public ZhiyuUser get(@PathVariable String id) {
        return userService.get(id);
    }

    @PostMapping
    public ZhiyuUser create(@RequestBody CreateUserRequest req) {
        return userService.create(req);
    }

    @PutMapping("/{id}")
    public ZhiyuUser update(@PathVariable String id, @RequestBody UpdateUserRequest req) {
        return userService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", userService.delete(id));
    }

    @PostMapping("/{id}/status")
    public ZhiyuUser updateStatus(@PathVariable String id, @RequestBody UpdateUserStatusRequest req) {
        return userService.updateStatus(id, req.getStatus());
    }

    @PostMapping("/{id}/reset-password")
    public Map<String, String> resetPassword(@PathVariable String id, @RequestBody ResetPasswordRequest req) {
        userService.resetPassword(id, req.getPassword());
        return Map.of("id", id);
    }

    @PostMapping("/{id}/roles")
    public ZhiyuUser bindRoles(@PathVariable String id, @RequestBody BindUserRolesRequest req) {
        return userService.bindRoles(id, req.getRoleIds());
    }

    @PostMapping("/batch")
    public ListResponse<ZhiyuUser> batchCreate(@RequestBody BatchCreateUserRequest req) {
        return userService.batchCreate(req.getUsers());
    }

    @PostMapping("/batch-graduate")
    public Map<String, Long> batchGraduate(@RequestBody BatchGraduateRequest req) {
        return Map.of("count", userService.batchGraduate(req.getUserIds(), req.getGraduateYear()));
    }

    @PostMapping("/batch-delete")
    public Map<String, Long> batchDelete(@RequestBody BatchDeleteUsersRequest req) {
        return Map.of("count", userService.batchDelete(req.getUserIds()));
    }

    @PostMapping("/batch-org-node")
    public Map<String, Long> batchUpdateOrgNode(@RequestBody BatchUpdateOrgNodeRequest req) {
        return Map.of("count", userService.batchUpdateOrgNode(req.getUserIds(), req.getOrgNodeId()));
    }
}
