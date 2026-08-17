package org.dromara.zhiyu.controller.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BatchCreateRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BatchDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BatchStatusRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BatchUpdateRequest;
import org.dromara.zhiyu.service.scene.ISceneBatchService;
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
 * 场景批次控制器（对齐 Go registerBatchRoutes 的 /scene/batches 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/scene/batches")
public class SceneBatchController {

    private final ISceneBatchService batchService;

    /** 批次列表（可按 orgNodeId/status/search 过滤） */
    @GetMapping
    public ListResponse<BatchDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                       @RequestParam(value = "offset", required = false) Long offset,
                                       @RequestParam(value = "orgNodeId", required = false) String orgNodeId,
                                       @RequestParam(value = "status", required = false) String status,
                                       @RequestParam(value = "search", required = false) String search) {
        return batchService.list(orgNodeId, status, search,
            limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    /** 批次详情 */
    @GetMapping("/{id}")
    public BatchDto get(@PathVariable String id) {
        return batchService.get(id);
    }

    /** 创建批次（status 恒为 open） */
    @PostMapping
    public BatchDto create(@RequestBody BatchCreateRequest req) {
        return batchService.create(req);
    }

    /** 更新批次（场景批次不更新 status） */
    @PutMapping("/{id}")
    public BatchDto update(@PathVariable String id, @RequestBody BatchUpdateRequest req) {
        return batchService.update(id, req);
    }

    /** 删除批次 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", batchService.delete(id));
    }

    /** 更新批次状态（open/closed） */
    @PostMapping("/{id}/status")
    public BatchDto updateStatus(@PathVariable String id, @RequestBody BatchStatusRequest req) {
        return batchService.updateStatus(id, req);
    }
}
