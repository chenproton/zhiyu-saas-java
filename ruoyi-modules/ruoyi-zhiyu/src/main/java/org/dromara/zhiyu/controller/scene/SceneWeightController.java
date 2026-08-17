package org.dromara.zhiyu.controller.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.WeightDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.WeightRequest;
import org.dromara.zhiyu.service.scene.ISceneWeightService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 场景权重控制器（对齐 Go routes_scene.go 的 /scene/weights 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/scene/weights")
public class SceneWeightController {

    private final ISceneWeightService weightService;

    /** 权重配置列表（可按 scenarioId/taskId 过滤） */
    @GetMapping
    public ListResponse<WeightDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                        @RequestParam(value = "offset", required = false) Long offset,
                                        @RequestParam(value = "scenarioId", required = false) String scenarioId,
                                        @RequestParam(value = "taskId", required = false) String taskId) {
        return weightService.list(scenarioId, taskId,
            limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    /** 权重 upsert（无 id：按 scenario_id+task_id 冲突更新） */
    @PostMapping
    public WeightDto upsert(@RequestBody WeightRequest req) {
        return weightService.upsert(req, null);
    }

    /** 权重 upsert（有 id：按 id 更新） */
    @PutMapping("/{id}")
    public WeightDto update(@PathVariable String id, @RequestBody WeightRequest req) {
        return weightService.upsert(req, id);
    }
}
