package org.dromara.zhiyu.controller.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CloneCourseRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CourseDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateCourseRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.UpdateCourseRequest;
import org.dromara.zhiyu.service.lesson.ILessonCourseService;
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
 * 课程控制器（对齐 Go routes_lesson.go /lesson/courses 路由组，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/lesson/courses")
public class LessonCourseController {

    private final ILessonCourseService courseService;

    /** 课程列表（search/type/category/status/batchId 过滤，limit/offset 分页） */
    @GetMapping
    public ListResponse<CourseDto> list(@RequestParam(value = "search", required = false) String search,
                                        @RequestParam(value = "type", required = false) String type,
                                        @RequestParam(value = "category", required = false) String category,
                                        @RequestParam(value = "status", required = false) String status,
                                        @RequestParam(value = "batchId", required = false) String batchId,
                                        @RequestParam(value = "limit", required = false) Long limit,
                                        @RequestParam(value = "offset", required = false) Long offset) {
        return courseService.list(search, type, category, status, batchId,
            limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    /** 课程详情 */
    @GetMapping("/{id}")
    public CourseDto get(@PathVariable String id) {
        return courseService.get(id);
    }

    /** 创建课程（draft 状态） */
    @PostMapping
    public CourseDto create(@RequestBody CreateCourseRequest req) {
        return courseService.create(req);
    }

    /** 更新课程（部分更新语义） */
    @PutMapping("/{id}")
    public CourseDto update(@PathVariable String id, @RequestBody UpdateCourseRequest req) {
        return courseService.update(id, req);
    }

    /** 删除课程 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", courseService.delete(id));
    }

    /** 提交审核 */
    @PostMapping("/{id}/submit")
    public CourseDto submit(@PathVariable String id) {
        return courseService.submit(id);
    }

    /** 审核（approved/rejected） */
    @PostMapping("/{id}/review")
    public CourseDto review(@PathVariable String id, @RequestBody ReviewRequest req) {
        return courseService.review(id, req);
    }

    /** 发布（版本 +0.1，落快照） */
    @PostMapping("/{id}/publish")
    public CourseDto publish(@PathVariable String id) {
        return courseService.publish(id);
    }

    /** 归档 */
    @PostMapping("/{id}/archive")
    public CourseDto archive(@PathVariable String id) {
        return courseService.archive(id);
    }

    /** 取消发布 */
    @PostMapping("/{id}/unpublish")
    public CourseDto unpublish(@PathVariable String id) {
        return courseService.unpublish(id);
    }

    /** 撤回（删除待审批记录） */
    @PostMapping("/{id}/withdraw")
    public CourseDto withdraw(@PathVariable String id) {
        return courseService.withdraw(id);
    }

    /** 存草稿 */
    @PostMapping("/{id}/save-draft")
    public CourseDto saveDraft(@PathVariable String id) {
        return courseService.saveDraft(id);
    }

    /** 邀请协作者 */
    @PostMapping("/{id}/invite")
    public CourseDto invite(@PathVariable String id, @RequestBody InviteRequest req) {
        return courseService.invite(id, req);
    }

    /** 克隆课程 */
    @PostMapping("/{id}/clone")
    public CourseDto clone(@PathVariable String id, @RequestBody(required = false) CloneCourseRequest req) {
        return courseService.clone(id, req == null ? new CloneCourseRequest() : req);
    }

    /** 课程快照 bundle（?version= 可选） */
    @GetMapping("/{id}/snapshot")
    public Map<String, Object> snapshot(@PathVariable String id,
                                        @RequestParam(value = "version", required = false) String version) {
        return courseService.getSnapshot(id, version);
    }
}
