package org.dromara.zhiyu.service.scene;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BatchCreateRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BatchDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BatchStatusRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BatchUpdateRequest;

/**
 * 场景批次服务（对齐 Go batch_handler.go + NewSceneBatchTableConfig 语义）。
 *
 * @author zhiyu
 */
public interface ISceneBatchService {

    /** 批次列表（可按 orgNodeId/status/search 过滤）。 */
    ListResponse<BatchDto> list(String orgNodeId, String status, String search, long limit, long offset);

    /** 批次详情。 */
    BatchDto get(String id);

    /** 创建批次（status 恒为 open）。 */
    BatchDto create(BatchCreateRequest req);

    /** 更新批次（null 字段保留原值；场景批次不更新 status）。 */
    BatchDto update(String id, BatchUpdateRequest req);

    /** 删除批次。 */
    String delete(String id);

    /** 更新批次状态（open/closed）。 */
    BatchDto updateStatus(String id, BatchStatusRequest req);
}
