package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.WorkflowDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.WorkflowRequest;

/**
 * 审批流程服务接口（对齐 Go WorkflowHandler）。
 *
 * @author zhiyu
 */
public interface IJobWorkflowService {

    /** 流程列表（ids 逗号拼接过滤 + name 搜索） */
    ListResponse<WorkflowDto> list(String ids, String search, long limit, long offset);

    /** 流程详情 */
    WorkflowDto get(String id);

    /** 创建流程（status 恒为 active） */
    WorkflowDto create(WorkflowRequest req);

    /** 更新流程（部分更新兜底） */
    WorkflowDto update(String id, WorkflowRequest req);

    /** 删除流程（仍有待审批单时 409 拒绝） */
    String delete(String id);
}
