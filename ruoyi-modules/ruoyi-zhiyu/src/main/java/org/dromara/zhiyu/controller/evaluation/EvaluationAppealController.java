package org.dromara.zhiyu.controller.evaluation;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.AppealDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateAppealRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ProcessAppealRequest;
import org.dromara.zhiyu.service.evaluation.IEvaluationAppealService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 申诉控制器（对齐 Go routes_evaluation.go /evaluation/appeals 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/evaluation/appeals")
public class EvaluationAppealController {

    private final IEvaluationAppealService appealService;

    @GetMapping
    public ListResponse<AppealDto> list(@RequestParam(value = "type", required = false) String type,
                                        @RequestParam(value = "status", required = false) String status,
                                        @RequestParam(value = "limit", required = false) Long limit,
                                        @RequestParam(value = "offset", required = false) Long offset) {
        return appealService.list(type, status, limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public AppealDto get(@PathVariable String id) {
        return appealService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AppealDto create(@RequestBody CreateAppealRequest req) {
        return appealService.create(req);
    }

    @PostMapping("/{id}/process")
    public AppealDto process(@PathVariable String id, @RequestBody ProcessAppealRequest req) {
        return appealService.process(id, req);
    }
}
