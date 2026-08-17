package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.BatchCreateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.BatchStatusRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.BatchUpdateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.JobBatchDto;

/**
 * 岗位批次服务接口（对齐 Go BatchHandler + NewJobBatchTableConfig）。
 *
 * @author zhiyu
 */
public interface IJobBatchService {

    /** 批次列表（orgNodeId/status/search 过滤） */
    ListResponse<JobBatchDto> list(String orgNodeId, String status, String search, long limit, long offset);

    /** 批次详情 */
    JobBatchDto get(String id);

    /** 创建批次（status 恒为 open） */
    JobBatchDto create(BatchCreateRequest req);

    /** 更新批次（不写 status，只能走 /{id}/status） */
    JobBatchDto update(String id, BatchUpdateRequest req);

    /** 删除批次 */
    String delete(String id);

    /** 更新批次状态（open/closed） */
    JobBatchDto updateStatus(String id, BatchStatusRequest req);
}
