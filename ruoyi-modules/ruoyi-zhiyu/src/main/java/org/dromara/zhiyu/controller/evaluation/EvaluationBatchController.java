package org.dromara.zhiyu.controller.evaluation;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.BatchRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.EvaluationBatchDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StatusRequest;
import org.dromara.zhiyu.service.evaluation.IEvaluationBatchService;
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
 * 评价域控制器：评价批次（batches，对齐 Go routes_evaluation.go 的 registerBatchRoutes）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/evaluation/batches")
public class EvaluationBatchController {

    private final IEvaluationBatchService batchService;

    @GetMapping
    public ListResponse<EvaluationBatchDto> list(@RequestParam(value = "orgNodeId", required = false) String orgNodeId,
                                                 @RequestParam(value = "status", required = false) String status,
                                                 @RequestParam(value = "search", required = false) String search,
                                                 @RequestParam(value = "limit", required = false) Long limit,
                                                 @RequestParam(value = "offset", required = false) Long offset) {
        return batchService.list(orgNodeId, status, search,
            limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public EvaluationBatchDto get(@PathVariable String id) {
        return batchService.get(id);
    }

    @PostMapping
    public EvaluationBatchDto create(@RequestBody BatchRequest req) {
        return batchService.create(req);
    }

    @PutMapping("/{id}")
    public EvaluationBatchDto update(@PathVariable String id, @RequestBody BatchRequest req) {
        return batchService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", batchService.delete(id));
    }

    @PostMapping("/{id}/status")
    public EvaluationBatchDto updateStatus(@PathVariable String id, @RequestBody StatusRequest req) {
        return batchService.updateStatus(id, req.getStatus());
    }
}
