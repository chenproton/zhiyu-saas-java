package org.dromara.zhiyu.controller.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BindResourceRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CreateTaskResourceRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskResourceDto;
import org.dromara.zhiyu.service.scene.ISceneTaskResourceService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 任务资源控制器（对齐 Go routes_scene.go 的 /scene/task-resources 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/scene/task-resources")
public class SceneTaskResourceController {

    private final ISceneTaskResourceService resourceService;

    /** 资源库列表（可按 taskId 绑定过滤 + search；默认 limit=50） */
    @GetMapping
    public ListResponse<TaskResourceDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                              @RequestParam(value = "offset", required = false) Long offset,
                                              @RequestParam(value = "taskId", required = false) String taskId,
                                              @RequestParam(value = "search", required = false) String search) {
        return resourceService.list(taskId, search,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 创建资源库条目（metadata 含 knowledgePointIds） */
    @PostMapping("/create")
    public TaskResourceDto create(@RequestBody CreateTaskResourceRequest req) {
        return resourceService.create(req);
    }

    /** 绑定已有资源到任务 */
    @PostMapping
    public Map<String, String> bind(@RequestBody BindResourceRequest req) {
        return Map.of("id", resourceService.bind(req));
    }

    /** 解绑（绑定不存在时静默成功） */
    @DeleteMapping("/{id}")
    public Map<String, String> unbind(@PathVariable String id) {
        return Map.of("id", resourceService.unbind(id));
    }
}
