package org.dromara.zhiyu.controller.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.GradeNodeResultRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeEvaluationResultDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.SubmitNodeEvaluationResultRequest;
import org.dromara.zhiyu.service.lesson.ILessonNodeEvaluationResultService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 节点测评结果控制器（对齐 Go routes_lesson.go /lesson/node-evaluation-results 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/lesson")
public class LessonNodeEvaluationResultController {

    private final ILessonNodeEvaluationResultService resultService;

    @GetMapping("/node-evaluation-results")
    public ListResponse<NodeEvaluationResultDto> list(@RequestParam(value = "nodeId", required = false) String nodeId,
                                                      @RequestParam(value = "evaluateeId", required = false) String evaluateeId,
                                                      @RequestParam(value = "limit", required = false) Long limit,
                                                      @RequestParam(value = "offset", required = false) Long offset) {
        return resultService.list(nodeId, evaluateeId, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/course-node-evaluation-results")
    public ListResponse<NodeEvaluationResultDto> listByCourse(@RequestParam(value = "courseId", required = false) String courseId) {
        return resultService.listByCourse(courseId);
    }

    @GetMapping("/node-evaluation-results/{id}")
    public NodeEvaluationResultDto get(@PathVariable String id) {
        return resultService.get(id);
    }

    @PostMapping("/node-evaluation-results/{id}/grade")
    public Map<String, Boolean> grade(@PathVariable String id, @RequestBody GradeNodeResultRequest req) {
        return Map.of("ok", resultService.grade(id, req));
    }

    @PostMapping("/node-evaluation-results")
    public NodeEvaluationResultDto submit(@RequestBody SubmitNodeEvaluationResultRequest req) {
        return resultService.submit(req);
    }
}
