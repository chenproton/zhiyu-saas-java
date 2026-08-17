package org.dromara.zhiyu.service.scene;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.WeightDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.WeightRequest;

/**
 * 场景权重配置服务（对齐 Go scenario_weight_handler.go 语义）。
 *
 * @author zhiyu
 */
public interface ISceneWeightService {

    /** 权重配置列表（可按 scenarioId/taskId 过滤）。 */
    ListResponse<WeightDto> list(String scenarioId, String taskId, long limit, long offset);

    /** 权重 upsert（有 id 更新，无 id 按 scenario_id+task_id 冲突更新）。 */
    WeightDto upsert(WeightRequest req, String urlId);
}
