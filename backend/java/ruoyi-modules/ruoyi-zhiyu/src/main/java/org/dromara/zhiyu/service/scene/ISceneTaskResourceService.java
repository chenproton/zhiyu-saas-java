package org.dromara.zhiyu.service.scene;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BindResourceRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CreateTaskResourceRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskResourceDto;

/**
 * 任务资源服务（对齐 Go task_resource_handler.go + service/resource_binding.go 语义）。
 *
 * @author zhiyu
 */
public interface ISceneTaskResourceService {

    /** 资源库列表（可按 taskId 绑定过滤 + search；默认 limit=50）。 */
    ListResponse<TaskResourceDto> list(String taskId, String search, long limit, long offset);

    /** 创建资源库条目（metadata 含 knowledgePointIds）。 */
    TaskResourceDto create(CreateTaskResourceRequest req);

    /** 绑定已有资源到任务（幂等）。 */
    String bind(BindResourceRequest req);

    /** 解绑（绑定不存在时静默成功）。 */
    String unbind(String id);
}
