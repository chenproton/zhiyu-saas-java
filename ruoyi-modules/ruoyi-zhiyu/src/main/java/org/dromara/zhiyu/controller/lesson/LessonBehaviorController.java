package org.dromara.zhiyu.controller.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BehaviorAggregateDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BehaviorRecordDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateBehaviorRecordRequest;
import org.dromara.zhiyu.service.lesson.ILessonBehaviorService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 课堂行为控制器（对齐 Go routes_lesson.go /lesson/behavior-collection 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/lesson/behavior-collection")
public class LessonBehaviorController {

    private final ILessonBehaviorService behaviorService;

    @GetMapping("/aggregate")
    public BehaviorAggregateDto aggregate(@RequestParam(value = "courseId", required = false) String courseId,
                                          @RequestParam(value = "startDate", required = false) String startDate,
                                          @RequestParam(value = "endDate", required = false) String endDate) {
        return behaviorService.aggregate(courseId, startDate, endDate);
    }

    @PostMapping("/records")
    @ResponseStatus(HttpStatus.CREATED)
    public BehaviorRecordDto create(@RequestBody CreateBehaviorRecordRequest req) {
        return behaviorService.create(req);
    }
}
