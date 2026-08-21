package org.dromara.zhiyu.controller.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CreateScenarioTaskRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ReorderTasksRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ScenarioTaskDto;
import org.dromara.zhiyu.service.scene.ISceneTaskService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 场景任务控制器（对齐 Go routes_scene.go 的 /scene/tasks 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/scene/tasks")
public class SceneTaskController {

    private final ISceneTaskService taskService;

    /** 任务列表（可按 scenarioId/search 过滤） */
    @GetMapping
    public ListResponse<ScenarioTaskDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                              @RequestParam(value = "offset", required = false) Long offset,
                                              @RequestParam(value = "scenarioId", required = false) String scenarioId,
                                              @RequestParam(value = "search", required = false) String search) {
        return taskService.list(scenarioId, search,
            limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    /** 任务详情 */
    @GetMapping("/{id}")
    public ScenarioTaskDto get(@PathVariable String id) {
        return taskService.get(id);
    }

    /** 创建任务 */
    @PostMapping
    public ScenarioTaskDto create(@RequestBody CreateScenarioTaskRequest req) {
        return taskService.create(req);
    }

    /** 更新任务（部分更新语义） */
    @PutMapping("/{id}")
    public ScenarioTaskDto update(@PathVariable String id, @RequestBody CreateScenarioTaskRequest req) {
        return taskService.update(id, req);
    }

    /** 删除任务 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", taskService.delete(id));
    }

    /** 批量重排任务排序 */
    @PostMapping("/reorder")
    public Map<String, Boolean> reorder(@RequestBody ReorderTasksRequest req) {
        return Map.of("ok", taskService.reorder(req));
    }
}
