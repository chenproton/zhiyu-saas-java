package org.dromara.zhiyu.service.scene;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CreateScenarioTaskRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ReorderTasksRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ScenarioTaskDto;

/**
 * 场景任务服务（对齐 Go scenario_task_handler.go + service/scenario.go 语义）。
 *
 * @author zhiyu
 */
public interface ISceneTaskService {

    /** 任务列表（学生仅可查已发布场景的任务）。 */
    ListResponse<ScenarioTaskDto> list(String scenarioId, String search, long limit, long offset);

    /** 任务详情（含知识点/能力点名称与测评摘要）。 */
    ScenarioTaskDto get(String id);

    /** 创建任务。 */
    ScenarioTaskDto create(CreateScenarioTaskRequest req);

    /** 更新任务（部分更新语义）。 */
    ScenarioTaskDto update(String id, CreateScenarioTaskRequest req);

    /** 删除任务（存在测评成绩时拒绝；事务内清理考试安排）。 */
    String delete(String id);

    /** 批量重排任务排序。 */
    boolean reorder(ReorderTasksRequest req);
}
