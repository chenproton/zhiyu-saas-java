package org.dromara.zhiyu.controller.evaluation;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.AddExamQuestionRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.BatchGradeRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateExamRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ExamCenterItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ExamDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ExamResultDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ExamUsageDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ExamUsageRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.GradeExamResultRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.GradeResultRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.SceneEvaluationResultDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.SubmitExamResultRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.SubmitResultRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.UpdateExamQuestionScoreRequest;
import org.dromara.zhiyu.service.evaluation.IEvaluationExamService;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 评价域控制器：试卷 / 考试安排 / 考试结果 / 场景测评结果（对齐 Go routes_evaluation.go）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/evaluation")
public class EvaluationExamController {

    private final IEvaluationExamService examService;

    // ==================== 试卷 exams ====================

    @GetMapping("/exams")
    public ListResponse<ExamDto> listExams(@RequestParam(value = "search", required = false) String search,
                                           @RequestParam(value = "status", required = false) String status,
                                           @RequestParam(value = "limit", required = false) Long limit,
                                           @RequestParam(value = "offset", required = false) Long offset) {
        return examService.listExams(search, status, limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/exams/{id}")
    public ExamDto getExam(@PathVariable String id) {
        return examService.getExam(id);
    }

    @PostMapping("/exams")
    public ExamDto createExam(@RequestBody CreateExamRequest req) {
        return examService.createExam(req);
    }

    @PutMapping("/exams/{id}")
    public ExamDto updateExam(@PathVariable String id, @RequestBody CreateExamRequest req) {
        return examService.updateExam(id, req);
    }

    @DeleteMapping("/exams/{id}")
    public Map<String, String> deleteExam(@PathVariable String id) {
        return Map.of("id", examService.deleteExam(id));
    }

    @PostMapping("/exams/{id}/submit")
    public ExamDto submitExam(@PathVariable String id) {
        return examService.submitExam(id);
    }

    @PostMapping("/exams/{id}/review")
    public ExamDto reviewExam(@PathVariable String id, @RequestBody ReviewRequest req) {
        return examService.reviewExam(id, req);
    }

    @PostMapping("/exams/{id}/publish")
    public ExamDto publishExam(@PathVariable String id) {
        return examService.publishExam(id);
    }

    @PostMapping("/exams/{id}/archive")
    public ExamDto archiveExam(@PathVariable String id) {
        return examService.archiveExam(id);
    }

    @PostMapping("/exams/{id}/unpublish")
    public ExamDto unpublishExam(@PathVariable String id) {
        return examService.unpublishExam(id);
    }

    @PostMapping("/exams/{id}/withdraw")
    public ExamDto withdrawExam(@PathVariable String id) {
        return examService.withdrawExam(id);
    }

    @PostMapping("/exams/{id}/save-draft")
    public ExamDto saveDraftExam(@PathVariable String id) {
        return examService.saveDraftExam(id);
    }

    @PostMapping("/exams/{id}/invite")
    public ExamDto inviteExam(@PathVariable String id, @RequestBody InviteRequest req) {
        return examService.inviteExam(id, req);
    }

    @PostMapping("/exams/{id}/questions")
    public ExamDto addExamQuestion(@PathVariable String id, @RequestBody AddExamQuestionRequest req) {
        return examService.addExamQuestion(id, req.getQuestionId(), req.getScore());
    }

    @DeleteMapping("/exams/{id}/questions/{questionId}")
    public ExamDto removeExamQuestion(@PathVariable String id, @PathVariable String questionId) {
        return examService.removeExamQuestion(id, questionId);
    }

    @PutMapping("/exams/{examId}/questions/{questionId}")
    public ExamDto updateExamQuestionScore(@PathVariable String examId, @PathVariable String questionId,
                                           @RequestBody UpdateExamQuestionScoreRequest req) {
        return examService.updateExamQuestionScore(examId, questionId, req);
    }

    @PutMapping("/exams/{examId}/questions/scores")
    public ExamDto bulkUpdateExamScores(@PathVariable String examId, @RequestBody Map<String, BigDecimal> scores) {
        return examService.bulkUpdateExamScores(examId, scores);
    }

    @GetMapping("/exams/{id}/snapshot")
    public Map<String, Object> examSnapshot(@PathVariable String id,
                                            @RequestParam(value = "version", required = false) String version) {
        return examService.examSnapshot(id, version);
    }

    // ==================== 考试安排 exam-usages ====================

    @GetMapping("/exam-usages")
    public ListResponse<ExamUsageDto> listExamUsages(@RequestParam(value = "search", required = false) String search,
                                                     @RequestParam(value = "examId", required = false) String examId,
                                                     @RequestParam(value = "status", required = false) String status,
                                                     @RequestParam(value = "scope", required = false) String scope,
                                                     @RequestParam(value = "limit", required = false) Long limit,
                                                     @RequestParam(value = "offset", required = false) Long offset) {
        return examService.listExamUsages(search, examId, status, scope,
            limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/exam-usages/{id}")
    public ExamUsageDto getExamUsage(@PathVariable String id) {
        return examService.getExamUsage(id);
    }

    @PostMapping("/exam-usages")
    public ExamUsageDto createExamUsage(@RequestBody ExamUsageRequest req) {
        return examService.createExamUsage(req);
    }

    @PutMapping("/exam-usages/{id}")
    public ExamUsageDto updateExamUsage(@PathVariable String id, @RequestBody ExamUsageRequest req) {
        return examService.updateExamUsage(id, req);
    }

    @DeleteMapping("/exam-usages/{id}")
    public Map<String, String> deleteExamUsage(@PathVariable String id) {
        return Map.of("id", examService.deleteExamUsage(id));
    }

    @PostMapping("/exam-usages/{id}/publish")
    public ExamUsageDto publishExamUsage(@PathVariable String id) {
        return examService.publishExamUsage(id);
    }

    @PostMapping("/exam-usages/{id}/finish")
    public ExamUsageDto finishExamUsage(@PathVariable String id) {
        return examService.finishExamUsage(id);
    }

    @GetMapping("/exam-center")
    public List<ExamCenterItemDto> examCenter() {
        return examService.examCenter();
    }

    // ==================== 考试结果 exam-results ====================

    @GetMapping("/exam-results")
    public ListResponse<ExamResultDto> listExamResults(@RequestParam(value = "usageId", required = false) String usageId,
                                                       @RequestParam(value = "limit", required = false) Long limit,
                                                       @RequestParam(value = "offset", required = false) Long offset) {
        return examService.listExamResults(usageId, limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/exam-results/{id}")
    public ExamResultDto getExamResult(@PathVariable String id) {
        return examService.getExamResult(id);
    }

    @PostMapping("/exam-results")
    public ExamResultDto submitExamResult(@RequestBody SubmitExamResultRequest req) {
        return examService.submitExamResult(req);
    }

    @PostMapping("/exam-results/{id}/grade")
    public ExamResultDto gradeExamResult(@PathVariable String id, @RequestBody GradeExamResultRequest req) {
        return examService.gradeExamResult(id, req);
    }

    // ==================== 场景测评结果 results ====================

    @GetMapping("/results")
    public ListResponse<SceneEvaluationResultDto> listResults(@RequestParam(value = "taskId", required = false) String taskId,
                                                              @RequestParam(value = "sceneId", required = false) String sceneId,
                                                              @RequestParam(value = "evaluateeId", required = false) String evaluateeId,
                                                              @RequestParam(value = "methodKey", required = false) String methodKey,
                                                              @RequestParam(value = "status", required = false) String status,
                                                              @RequestParam(value = "limit", required = false) Long limit,
                                                              @RequestParam(value = "offset", required = false) Long offset) {
        return examService.listResults(taskId, sceneId, evaluateeId, methodKey, status,
            limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/results/{id}")
    public SceneEvaluationResultDto getResult(@PathVariable String id) {
        return examService.getResult(id);
    }

    @PostMapping("/results")
    public SceneEvaluationResultDto submitResult(@RequestBody SubmitResultRequest req) {
        return examService.submitResult(req);
    }

    @PostMapping("/results/{id}/grade")
    public SceneEvaluationResultDto gradeResult(@PathVariable String id, @RequestBody GradeResultRequest req) {
        return examService.gradeResult(id, req);
    }

    @PostMapping("/results/batch-grade")
    public Map<String, Integer> batchGradeResults(@RequestBody BatchGradeRequest req) {
        return Map.of("count", examService.batchGradeResults(req));
    }
}
