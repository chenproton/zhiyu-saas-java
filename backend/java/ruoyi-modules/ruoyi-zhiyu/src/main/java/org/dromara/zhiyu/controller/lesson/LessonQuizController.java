package org.dromara.zhiyu.controller.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateQuizRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeQuizDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeQuizQuestionDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.QuizQuestionRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.UpdateQuizRequest;
import org.dromara.zhiyu.service.lesson.ILessonQuizService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 节点测验控制器（对齐 Go routes_lesson.go /lesson/quizzes 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/lesson/quizzes")
public class LessonQuizController {

    private final ILessonQuizService quizService;

    @GetMapping
    public ListResponse<NodeQuizDto> listQuizzes(@RequestParam(value = "nodeId", required = false) String nodeId) {
        return quizService.listQuizzes(nodeId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NodeQuizDto createQuiz(@RequestBody CreateQuizRequest req) {
        return quizService.createQuiz(req);
    }

    @GetMapping("/{id}")
    public ListResponse<NodeQuizQuestionDto> listQuestions(@PathVariable String id,
                                                           @RequestParam(value = "limit", required = false) Long limit,
                                                           @RequestParam(value = "offset", required = false) Long offset) {
        return quizService.listQuestions(id, limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @PutMapping("/{id}")
    public NodeQuizDto updateQuiz(@PathVariable String id, @RequestBody UpdateQuizRequest req) {
        return quizService.updateQuiz(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> deleteQuiz(@PathVariable String id) {
        return Map.of("id", quizService.deleteQuiz(id));
    }

    @PostMapping("/{id}/questions")
    @ResponseStatus(HttpStatus.CREATED)
    public NodeQuizQuestionDto addQuestion(@PathVariable String id, @RequestBody QuizQuestionRequest req) {
        return quizService.addQuestion(id, req);
    }

    @PutMapping("/questions/{questionId}")
    public NodeQuizQuestionDto updateQuestion(@PathVariable String questionId, @RequestBody QuizQuestionRequest req) {
        return quizService.updateQuestion(questionId, req);
    }

    @DeleteMapping("/questions/{questionId}")
    public Map<String, String> deleteQuestion(@PathVariable String questionId) {
        return Map.of("id", quizService.deleteQuestion(questionId));
    }
}
