package org.dromara.zhiyu.controller.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchSaveHybridModulesRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.HybridNodeModuleDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.UpsertHybridModuleRequest;
import org.dromara.zhiyu.service.lesson.ILessonHybridModuleService;
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
 * 混合模块控制器（对齐 Go routes_lesson.go /lesson/hybrid-modules 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/lesson/hybrid-modules")
public class LessonHybridModuleController {

    private final ILessonHybridModuleService hybridModuleService;

    @GetMapping
    public ListResponse<HybridNodeModuleDto> list(@RequestParam(value = "nodeId", required = false) String nodeId,
                                                  @RequestParam(value = "courseId", required = false) String courseId) {
        return hybridModuleService.list(nodeId, courseId);
    }

    @PostMapping("/batch")
    public Map<String, String> batchSave(@RequestBody BatchSaveHybridModulesRequest req) {
        return Map.of("nodeId", hybridModuleService.batchSave(req));
    }

    @PostMapping
    public HybridNodeModuleDto upsert(@RequestBody UpsertHybridModuleRequest req) {
        return hybridModuleService.upsert(req, null);
    }

    @PutMapping("/{id}")
    public HybridNodeModuleDto update(@PathVariable String id, @RequestBody UpsertHybridModuleRequest req) {
        return hybridModuleService.upsert(req, id);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", hybridModuleService.delete(id));
    }
}
