package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ApprovalCreateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ApprovalRecordDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ApprovalReviewRequest;
import org.dromara.zhiyu.service.job.IJobApprovalService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 审批记录控制器（对齐 Go registerWorkflowRoutes 的 /approvals 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/approvals")
public class JobApprovalController {

    private final IJobApprovalService approvalService;

    /** 审批记录列表（status/targetType/submitterId 过滤） */
    @GetMapping
    public ListResponse<ApprovalRecordDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                                @RequestParam(value = "offset", required = false) Long offset,
                                                @RequestParam(value = "status", required = false) String status,
                                                @RequestParam(value = "targetType", required = false) String targetType,
                                                @RequestParam(value = "submitterId", required = false) String submitterId) {
        return approvalService.list(status, targetType, submitterId,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 审批记录详情 */
    @GetMapping("/{id}")
    public ApprovalRecordDto get(@PathVariable String id) {
        return approvalService.get(id);
    }

    /** 创建审批记录 */
    @PostMapping
    public ApprovalRecordDto create(@RequestBody ApprovalCreateRequest req) {
        return approvalService.create(req);
    }

    /** 评审审批（action: approved/rejected） */
    @PostMapping("/{id}/review")
    public ApprovalRecordDto review(@PathVariable String id, @RequestBody ApprovalReviewRequest req) {
        return approvalService.review(id, req);
    }
}
