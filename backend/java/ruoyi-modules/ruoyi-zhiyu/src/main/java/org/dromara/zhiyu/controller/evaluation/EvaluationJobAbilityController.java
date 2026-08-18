package org.dromara.zhiyu.controller.evaluation;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CourseScoreItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilityAggregateLogDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilityAggregateRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilityResultItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilitySummaryItemDto;
import org.dromara.zhiyu.service.evaluation.IEvaluationJobAbilityService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 评价域控制器：岗位能力结果（job-ability，对齐 Go routes_evaluation.go）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/evaluation/job-ability")
public class EvaluationJobAbilityController {

    private final IEvaluationJobAbilityService jobAbilityService;

    @GetMapping("/results")
    public ListResponse<JobAbilityResultItemDto> listResults(
        @RequestParam(value = "careerPositionId", required = false) String careerPositionId,
        @RequestParam(value = "userId", required = false) String userId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "grade", required = false) String grade,
        @RequestParam(value = "page", required = false) Integer page,
        @RequestParam(value = "limit", required = false) Integer limit) {
        return jobAbilityService.listResults(careerPositionId, userId, search, grade,
            page == null ? 1 : page, limit == null ? 0 : limit);
    }

    @GetMapping("/results/{id}")
    public JobAbilityResultItemDto getResult(@PathVariable String id) {
        return jobAbilityService.getResult(id);
    }

    @GetMapping("/results/summary")
    public List<JobAbilitySummaryItemDto> summary() {
        return jobAbilityService.summary();
    }

    @GetMapping("/course-scores")
    public ListResponse<CourseScoreItemDto> courseScores(@RequestParam(value = "userId", required = false) String userId) {
        return jobAbilityService.courseScores(userId);
    }

    @PostMapping("/aggregate")
    public Map<String, String> aggregate(@RequestBody JobAbilityAggregateRequest req) {
        return jobAbilityService.aggregate(req);
    }

    @GetMapping("/aggregate/status")
    public JobAbilityAggregateLogDto aggregateStatus(
        @RequestParam(value = "careerPositionId", required = false) String careerPositionId,
        @RequestParam(value = "logId", required = false) String logId) {
        return jobAbilityService.aggregateStatus(careerPositionId, logId);
    }
}
