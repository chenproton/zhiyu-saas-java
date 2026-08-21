package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.WorkflowDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.WorkflowRequest;
import org.dromara.zhiyu.service.job.IJobWorkflowService;
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
 * 审批流程控制器（对齐 Go registerWorkflowRoutes 的 /workflows 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/workflows")
public class JobWorkflowController {

    private final IJobWorkflowService workflowService;

    /** 流程列表（ids 逗号拼接 + search 过滤） */
    @GetMapping
    public ListResponse<WorkflowDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                          @RequestParam(value = "offset", required = false) Long offset,
                                          @RequestParam(value = "ids", required = false) String ids,
                                          @RequestParam(value = "search", required = false) String search) {
        return workflowService.list(ids, search, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 流程详情 */
    @GetMapping("/{id}")
    public WorkflowDto get(@PathVariable String id) {
        return workflowService.get(id);
    }

    /** 创建流程（status 恒为 active） */
    @PostMapping
    public WorkflowDto create(@RequestBody WorkflowRequest req) {
        return workflowService.create(req);
    }

    /** 更新流程 */
    @PutMapping("/{id}")
    public WorkflowDto update(@PathVariable String id, @RequestBody WorkflowRequest req) {
        return workflowService.update(id, req);
    }

    /** 删除流程 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", workflowService.delete(id));
    }
}
