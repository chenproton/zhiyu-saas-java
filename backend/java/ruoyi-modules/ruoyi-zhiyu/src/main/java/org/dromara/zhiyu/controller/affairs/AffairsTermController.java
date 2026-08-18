package org.dromara.zhiyu.controller.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TermDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TermPayload;
import org.dromara.zhiyu.service.affairs.ITermService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 学期控制器（对齐 Go /affairs/terms 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/affairs/terms")
public class AffairsTermController {

    private final ITermService termService;

    @GetMapping
    public ListResponse<TermDto> list(@RequestParam(value = "search", required = false) String search,
                                      @RequestParam(value = "isCurrent", required = false) String isCurrent,
                                      @RequestParam(value = "limit", required = false) Long limit,
                                      @RequestParam(value = "offset", required = false) Long offset) {
        return termService.list(search, isCurrent, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public TermDto get(@PathVariable String id) {
        return termService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TermDto create(@RequestBody TermPayload payload) {
        return termService.create(payload);
    }

    @PutMapping("/{id}")
    public TermDto update(@PathVariable String id, @RequestBody TermPayload payload) {
        return termService.update(id, payload);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", termService.delete(id));
    }
}
