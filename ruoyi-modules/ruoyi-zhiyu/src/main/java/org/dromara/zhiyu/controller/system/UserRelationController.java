package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.CreateUserRelationRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UserRelationItem;
import org.dromara.zhiyu.service.system.ISystemUserRelationService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 用户关系控制器（对齐 Go user_relation_handler.go 的 /user-relations 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/user-relations")
public class UserRelationController {

    private final ISystemUserRelationService relationService;

    @GetMapping
    public ListResponse<UserRelationItem> list(@RequestParam(value = "search", required = false) String search,
                                               @RequestParam(value = "limit", required = false) Long limit,
                                               @RequestParam(value = "offset", required = false) Long offset) {
        return relationService.list(search, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @PostMapping
    public Map<String, String> create(@RequestBody CreateUserRelationRequest req) {
        return Map.of("id", relationService.create(req));
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", relationService.delete(id));
    }
}
