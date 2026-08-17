package org.dromara.zhiyu.controller.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.AffairsBatchDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.AffairsBatchPayload;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.StatusRequest;
import org.dromara.zhiyu.service.affairs.IAffairsBatchService;
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
 * 教务批次控制器（对齐 Go /affairs/batches 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/affairs/batches")
public class AffairsBatchController {

    private final IAffairsBatchService batchService;

    @GetMapping
    public ListResponse<AffairsBatchDto> list(@RequestParam(value = "search", required = false) String search,
                                              @RequestParam(value = "orgNodeId", required = false) String orgNodeId,
                                              @RequestParam(value = "status", required = false) String status,
                                              @RequestParam(value = "limit", required = false) Long limit,
                                              @RequestParam(value = "offset", required = false) Long offset) {
        return batchService.list(search, orgNodeId, status, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public AffairsBatchDto get(@PathVariable String id) {
        return batchService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AffairsBatchDto create(@RequestBody AffairsBatchPayload payload) {
        return batchService.create(payload);
    }

    @PutMapping("/{id}")
    public AffairsBatchDto update(@PathVariable String id, @RequestBody AffairsBatchPayload payload) {
        return batchService.update(id, payload);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", batchService.delete(id));
    }

    @PostMapping("/{id}/status")
    public AffairsBatchDto updateStatus(@PathVariable String id, @RequestBody StatusRequest req) {
        return batchService.updateStatus(id, req.getStatus());
    }
}
