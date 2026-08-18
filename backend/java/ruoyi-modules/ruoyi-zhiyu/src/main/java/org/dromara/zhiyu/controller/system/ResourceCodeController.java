package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemResourceCode;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.ResourceCodeRequest;
import org.dromara.zhiyu.service.system.ISystemResourceCodeService;
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
 * 资源编码控制器（对齐 Go resource_code_handler.go 的 /resource-codes 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/resource-codes")
public class ResourceCodeController {

    private final ISystemResourceCodeService resourceCodeService;

    @GetMapping
    public ListResponse<SystemResourceCode> list(@RequestParam(value = "search", required = false) String search,
                                                 @RequestParam(value = "type", required = false) String type,
                                                 @RequestParam(value = "limit", required = false) Long limit,
                                                 @RequestParam(value = "offset", required = false) Long offset) {
        return resourceCodeService.list(search, type, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public SystemResourceCode get(@PathVariable String id) {
        return resourceCodeService.get(id);
    }

    @PostMapping
    public SystemResourceCode create(@RequestBody ResourceCodeRequest req) {
        return resourceCodeService.create(req);
    }

    @PutMapping("/{id}")
    public SystemResourceCode update(@PathVariable String id, @RequestBody ResourceCodeRequest req) {
        return resourceCodeService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", resourceCodeService.delete(id));
    }
}
