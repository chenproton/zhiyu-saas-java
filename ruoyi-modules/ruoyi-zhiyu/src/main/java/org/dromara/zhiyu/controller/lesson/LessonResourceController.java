package org.dromara.zhiyu.controller.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BindCourseResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BindNodeResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateCourseResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateNodeResourceRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeResourceDto;
import org.dromara.zhiyu.service.lesson.ILessonResourceService;
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
 * 节点/课程资源控制器（对齐 Go routes_lesson.go /lesson/node-resources 与 /lesson/course-resources 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/lesson")
public class LessonResourceController {

    private final ILessonResourceService resourceService;

    // ---------- 节点资源 ----------

    @GetMapping("/node-resources")
    public ListResponse<NodeResourceDto> listNodeResources(@RequestParam(value = "nodeId", required = false) String nodeId,
                                                           @RequestParam(value = "search", required = false) String search,
                                                           @RequestParam(value = "limit", required = false) Long limit,
                                                           @RequestParam(value = "offset", required = false) Long offset) {
        return resourceService.listNodeResources(nodeId, search, limit == null ? 200 : limit,
            offset == null ? 0 : offset);
    }

    @PostMapping("/node-resources/create")
    public NodeResourceDto createNodeResource(@RequestBody CreateNodeResourceRequest req) {
        return resourceService.createNodeResource(req);
    }

    @PostMapping("/node-resources")
    public Map<String, String> bindNodeResource(@RequestBody BindNodeResourceRequest req) {
        return Map.of("id", resourceService.bindNodeResource(req));
    }

    @DeleteMapping("/node-resources/{id}")
    public Map<String, String> unbindNodeResource(@PathVariable String id) {
        return Map.of("id", resourceService.unbindNodeResource(id));
    }

    // ---------- 课程资源 ----------

    @GetMapping("/course-resources")
    public ListResponse<NodeResourceDto> listCourseResources(@RequestParam(value = "courseId", required = false) String courseId,
                                                             @RequestParam(value = "search", required = false) String search,
                                                             @RequestParam(value = "limit", required = false) Long limit,
                                                             @RequestParam(value = "offset", required = false) Long offset) {
        return resourceService.listCourseResources(courseId, search, limit == null ? 200 : limit,
            offset == null ? 0 : offset);
    }

    @PostMapping("/course-resources/create")
    public NodeResourceDto createCourseResource(@RequestBody CreateCourseResourceRequest req) {
        return resourceService.createCourseResource(req);
    }

    @PostMapping("/course-resources")
    public Map<String, String> bindCourseResource(@RequestBody BindCourseResourceRequest req) {
        return Map.of("id", resourceService.bindCourseResource(req));
    }

    @DeleteMapping("/course-resources/{id}")
    public Map<String, String> unbindCourseResource(@PathVariable String id) {
        return Map.of("id", resourceService.unbindCourseResource(id));
    }
}
