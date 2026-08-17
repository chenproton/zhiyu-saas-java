package org.dromara.zhiyu.service.affairs;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.AffairsBatchDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.AffairsBatchPayload;

/**
 * 教务批次服务（对齐 Go batch_handler.go + store/batches.go + batch_configs.go）。
 *
 * @author zhiyu
 */
public interface IAffairsBatchService {

    ListResponse<AffairsBatchDto> list(String search, String orgNodeId, String status, long limit, long offset);

    AffairsBatchDto get(String id);

    AffairsBatchDto create(AffairsBatchPayload payload);

    AffairsBatchDto update(String id, AffairsBatchPayload payload);

    String delete(String id);

    AffairsBatchDto updateStatus(String id, String status);
}
