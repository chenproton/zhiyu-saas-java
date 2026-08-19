package org.dromara.zhiyu.controller.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.GradeMappingDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.GradeMappingRequest;
import org.dromara.zhiyu.service.scene.ISceneGradeMappingService;
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
 * 场景等级映射控制器（对齐 Go routes_scene.go /scene/grade-mappings 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/scene/grade-mappings")
public class SceneGradeMappingController {

    private final ISceneGradeMappingService gradeMappingService;

    @GetMapping
    public ListResponse<GradeMappingDto> list(@RequestParam(value = "scenarioId", required = false) String scenarioId,
                                              @RequestParam(value = "taskId", required = false) String taskId,
                                              @RequestParam(value = "limit", required = false) Long limit,
                                              @RequestParam(value = "offset", required = false) Long offset) {
        return gradeMappingService.list(scenarioId, taskId, limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @PostMapping
    public GradeMappingDto upsert(@RequestBody GradeMappingRequest req) {
        return gradeMappingService.upsert(req, null);
    }

    @PutMapping("/{id}")
    public GradeMappingDto update(@PathVariable String id, @RequestBody GradeMappingRequest req) {
        return gradeMappingService.upsert(req, id);
    }
}
