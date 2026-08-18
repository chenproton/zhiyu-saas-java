package org.dromara.zhiyu.controller.system;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.system.SystemStaffTitle;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.StaffTitleRequest;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.ToggleStatusRequest;
import org.dromara.zhiyu.service.system.ISystemStaffTitleService;
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
 * 职称控制器（对齐 Go staff_title_handler.go 的 /staff-titles 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/staff-titles")
public class StaffTitleController {

    private final ISystemStaffTitleService titleService;

    @GetMapping
    public ListResponse<SystemStaffTitle> list(@RequestParam(value = "search", required = false) String search,
                                               @RequestParam(value = "limit", required = false) Long limit,
                                               @RequestParam(value = "offset", required = false) Long offset) {
        return titleService.list(search, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public SystemStaffTitle get(@PathVariable String id) {
        return titleService.get(id);
    }

    @PostMapping
    public SystemStaffTitle create(@RequestBody StaffTitleRequest req) {
        return titleService.create(req);
    }

    @PutMapping("/{id}")
    public SystemStaffTitle update(@PathVariable String id, @RequestBody StaffTitleRequest req) {
        return titleService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", titleService.delete(id));
    }

    @PostMapping("/{id}/status")
    public SystemStaffTitle toggleStatus(@PathVariable String id, @RequestBody ToggleStatusRequest req) {
        return titleService.toggleStatus(id, req.getStatus());
    }
}
