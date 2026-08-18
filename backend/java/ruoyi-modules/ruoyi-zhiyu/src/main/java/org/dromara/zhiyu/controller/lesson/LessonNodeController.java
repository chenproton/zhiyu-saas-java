package org.dromara.zhiyu.controller.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateNodeRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.ReorderNodesRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.SystemCourseNodeDto;
import org.dromara.zhiyu.service.lesson.ILessonNodeService;
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
 * 课程节点控制器（对齐 Go routes_lesson.go /lesson/nodes 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/lesson/nodes")
public class LessonNodeController {

    private final ILessonNodeService nodeService;

    @GetMapping
    public ListResponse<SystemCourseNodeDto> list(@RequestParam(value = "courseId", required = false) String courseId,
                                                  @RequestParam(value = "parentId", required = false) String parentId,
                                                  @RequestParam(value = "rootOnly", required = false) String rootOnly) {
        return nodeService.list(courseId, parentId, rootOnly);
    }

    @GetMapping("/{id}")
    public SystemCourseNodeDto get(@PathVariable String id) {
        return nodeService.get(id);
    }

    @PostMapping
    public SystemCourseNodeDto create(@RequestBody CreateNodeRequest req) {
        return nodeService.create(req);
    }

    @PutMapping("/{id}")
    public SystemCourseNodeDto update(@PathVariable String id, @RequestBody CreateNodeRequest req) {
        return nodeService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", nodeService.delete(id));
    }

    @PostMapping("/reorder")
    public Map<String, Boolean> reorder(@RequestBody ReorderNodesRequest req) {
        return Map.of("ok", nodeService.reorder(req));
    }
}
