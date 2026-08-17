package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ApprovalCreateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ApprovalRecordDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ApprovalReviewRequest;

/**
 * 审批记录服务接口（对齐 Go ApprovalHandler）。
 *
 * @author zhiyu
 */
public interface IJobApprovalService {

    /** 审批记录列表（status/targetType/submitterId 过滤） */
    ListResponse<ApprovalRecordDto> list(String status, String targetType, String submitterId,
                                         long limit, long offset);

    /** 审批记录详情 */
    ApprovalRecordDto get(String id);

    /** 创建审批记录（同一目标仅允许一条 pending 记录） */
    ApprovalRecordDto create(ApprovalCreateRequest req);

    /** 评审审批（行锁 + 决策 + CAS 推进；终态同步实体状态） */
    ApprovalRecordDto review(String id, ApprovalReviewRequest req);
}
