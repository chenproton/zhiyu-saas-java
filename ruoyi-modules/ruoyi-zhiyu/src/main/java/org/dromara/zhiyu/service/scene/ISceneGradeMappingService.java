package org.dromara.zhiyu.service.scene;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.GradeMappingDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.GradeMappingRequest;

/**
 * 场景等级映射服务（对齐 Go scenario_grade_handler.go + store/scenario_configs.go 语义）。
 *
 * @author zhiyu
 */
public interface ISceneGradeMappingService {

    /** 等级映射列表（scenarioId/taskId 过滤）。 */
    ListResponse<GradeMappingDto> list(String scenarioId, String taskId, long limit, long offset);

    /** 等级映射 upsert（urlId 非空时按 id 更新）。 */
    GradeMappingDto upsert(GradeMappingRequest req, String urlId);

    /** 删除等级映射。 */
    String delete(String id);
}
