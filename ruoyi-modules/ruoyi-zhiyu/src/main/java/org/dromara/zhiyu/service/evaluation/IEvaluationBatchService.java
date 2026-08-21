package org.dromara.zhiyu.service.evaluation;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.BatchRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.EvaluationBatchDto;

/**
 * 评价批次服务（batches），对齐 Go BatchHandler + evaluation_batches 表配置。
 *
 * @author zhiyu
 */
public interface IEvaluationBatchService {

    ListResponse<EvaluationBatchDto> list(String orgNodeId, String status, String search, long limit, long offset);

    EvaluationBatchDto get(String id);

    EvaluationBatchDto create(BatchRequest req);

    EvaluationBatchDto update(String id, BatchRequest req);

    String delete(String id);

    EvaluationBatchDto updateStatus(String id, String status);
}
