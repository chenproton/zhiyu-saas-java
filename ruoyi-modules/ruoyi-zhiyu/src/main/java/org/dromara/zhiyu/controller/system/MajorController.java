package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemMajor;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.MajorRequest;
import org.dromara.zhiyu.service.system.ISystemMajorService;
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
 * 专业控制器（对齐 Go major_handler.go 的 /majors 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/majors")
public class MajorController {

    private final ISystemMajorService majorService;

    @GetMapping
    public ListResponse<SystemMajor> list(@RequestParam(value = "search", required = false) String search,
                                          @RequestParam(value = "enabled", required = false) String enabled,
                                          @RequestParam(value = "limit", required = false) Long limit,
                                          @RequestParam(value = "offset", required = false) Long offset) {
        return majorService.list(search, enabled, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public SystemMajor get(@PathVariable String id) {
        return majorService.get(id);
    }

    @PostMapping
    public SystemMajor create(@RequestBody MajorRequest req) {
        return majorService.create(req);
    }

    @PutMapping("/{id}")
    public SystemMajor update(@PathVariable String id, @RequestBody MajorRequest req) {
        return majorService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", majorService.delete(id));
    }
}
