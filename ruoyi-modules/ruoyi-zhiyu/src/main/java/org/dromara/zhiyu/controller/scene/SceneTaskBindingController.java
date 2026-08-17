package org.dromara.zhiyu.controller.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BindAbilityRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BindKnowledgeRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskAbilityBindingDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskKnowledgeBindingDto;
import org.dromara.zhiyu.service.scene.ISceneTaskBindingService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 场景任务绑定控制器（对齐 Go routes_scene.go /scene/task-bindings 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/scene/task-bindings")
public class SceneTaskBindingController {

    private final ISceneTaskBindingService taskBindingService;

    @PostMapping("/knowledge")
    public TaskKnowledgeBindingDto bindKnowledge(@RequestBody BindKnowledgeRequest req) {
        return taskBindingService.bindKnowledge(req);
    }

    @DeleteMapping("/knowledge/{id}")
    public Map<String, String> unbindKnowledge(@PathVariable String id) {
        return Map.of("id", taskBindingService.unbindKnowledge(id));
    }

    @PostMapping("/ability")
    public TaskAbilityBindingDto bindAbility(@RequestBody BindAbilityRequest req) {
        return taskBindingService.bindAbility(req);
    }

    @DeleteMapping("/ability/{id}")
    public Map<String, String> unbindAbility(@PathVariable String id) {
        return Map.of("id", taskBindingService.unbindAbility(id));
    }
}
