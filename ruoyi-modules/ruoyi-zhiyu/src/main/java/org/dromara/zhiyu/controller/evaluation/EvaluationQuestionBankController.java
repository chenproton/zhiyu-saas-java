package org.dromara.zhiyu.controller.evaluation;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.BatchCreateQuestionsRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateQuestionBankRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateQuestionRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.QuestionBankDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.QuestionDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.RandomDrawQuestionDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.RandomDrawQuestionRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ReviewRequest;
import org.dromara.zhiyu.service.evaluation.IEvaluationQuestionBankService;
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

import java.util.List;
import java.util.Map;

/**
 * 评价域控制器：题库 / 题目 / 随机抽题（对齐 Go routes_evaluation.go，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/evaluation")
public class EvaluationQuestionBankController {

    private final IEvaluationQuestionBankService questionBankService;

    // ==================== 题库 question-banks ====================

    @GetMapping("/question-banks")
    public ListResponse<QuestionBankDto> listBanks(@RequestParam(value = "search", required = false) String search,
                                                   @RequestParam(value = "status", required = false) String status,
                                                   @RequestParam(value = "limit", required = false) Long limit,
                                                   @RequestParam(value = "offset", required = false) Long offset) {
        return questionBankService.listBanks(search, status, limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/question-banks/{id}")
    public QuestionBankDto getBank(@PathVariable String id) {
        return questionBankService.getBank(id);
    }

    @PostMapping("/question-banks")
    public QuestionBankDto createBank(@RequestBody CreateQuestionBankRequest req) {
        return questionBankService.createBank(req);
    }

    @PutMapping("/question-banks/{id}")
    public QuestionBankDto updateBank(@PathVariable String id, @RequestBody CreateQuestionBankRequest req) {
        return questionBankService.updateBank(id, req);
    }

    @DeleteMapping("/question-banks/{id}")
    public Map<String, String> deleteBank(@PathVariable String id) {
        return Map.of("id", questionBankService.deleteBank(id));
    }

    @PostMapping("/question-banks/{id}/submit")
    public QuestionBankDto submitBank(@PathVariable String id) {
        return questionBankService.submitBank(id);
    }

    @PostMapping("/question-banks/{id}/review")
    public QuestionBankDto reviewBank(@PathVariable String id, @RequestBody ReviewRequest req) {
        return questionBankService.reviewBank(id, req);
    }

    @PostMapping("/question-banks/{id}/publish")
    public QuestionBankDto publishBank(@PathVariable String id) {
        return questionBankService.publishBank(id);
    }

    @PostMapping("/question-banks/{id}/archive")
    public QuestionBankDto archiveBank(@PathVariable String id) {
        return questionBankService.archiveBank(id);
    }

    @PostMapping("/question-banks/{id}/unpublish")
    public QuestionBankDto unpublishBank(@PathVariable String id) {
        return questionBankService.unpublishBank(id);
    }

    @PostMapping("/question-banks/{id}/withdraw")
    public QuestionBankDto withdrawBank(@PathVariable String id) {
        return questionBankService.withdrawBank(id);
    }

    @PostMapping("/question-banks/{id}/save-draft")
    public QuestionBankDto saveDraftBank(@PathVariable String id) {
        return questionBankService.saveDraftBank(id);
    }

    @PostMapping("/question-banks/{id}/invite")
    public QuestionBankDto inviteBank(@PathVariable String id, @RequestBody InviteRequest req) {
        return questionBankService.inviteBank(id, req);
    }

    @GetMapping("/question-banks/{id}/snapshot")
    public Map<String, Object> bankSnapshot(@PathVariable String id,
                                            @RequestParam(value = "version", required = false) String version) {
        return questionBankService.bankSnapshot(id, version);
    }

    // ==================== 题目 questions ====================

    @GetMapping("/questions")
    public ListResponse<QuestionDto> listQuestions(@RequestParam(value = "search", required = false) String search,
                                                   @RequestParam(value = "bankId", required = false) String bankId,
                                                   @RequestParam(value = "type", required = false) String type,
                                                   @RequestParam(value = "status", required = false) String status,
                                                   @RequestParam(value = "limit", required = false) Long limit,
                                                   @RequestParam(value = "offset", required = false) Long offset) {
        return questionBankService.listQuestions(search, bankId, type, status,
            limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/questions/{id}")
    public QuestionDto getQuestion(@PathVariable String id) {
        return questionBankService.getQuestion(id);
    }

    @PostMapping("/questions")
    public QuestionDto createQuestion(@RequestBody CreateQuestionRequest req) {
        return questionBankService.createQuestion(req);
    }

    @PutMapping("/questions/{id}")
    public QuestionDto updateQuestion(@PathVariable String id, @RequestBody CreateQuestionRequest req) {
        return questionBankService.updateQuestion(id, req);
    }

    @DeleteMapping("/questions/{id}")
    public Map<String, String> deleteQuestion(@PathVariable String id) {
        return Map.of("id", questionBankService.deleteQuestion(id));
    }

    @PostMapping("/questions/batch")
    public Map<String, Integer> batchCreateQuestions(@RequestBody BatchCreateQuestionsRequest req) {
        return Map.of("count", questionBankService.batchCreateQuestions(req.getBankId(), req.getItems()));
    }

    // ==================== 随机抽题 random-draw-questions ====================

    @GetMapping("/random-draw-questions")
    public ListResponse<RandomDrawQuestionDto> listRandomDraw(@RequestParam(value = "search", required = false) String search,
                                                              @RequestParam(value = "majorId", required = false) String majorId,
                                                              @RequestParam(value = "limit", required = false) Long limit,
                                                              @RequestParam(value = "offset", required = false) Long offset) {
        return questionBankService.listRandomDraw(search, majorId, limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/random-draw-questions/{id}")
    public RandomDrawQuestionDto getRandomDraw(@PathVariable String id) {
        return questionBankService.getRandomDraw(id);
    }

    @PostMapping("/random-draw-questions")
    public RandomDrawQuestionDto createRandomDraw(@RequestBody RandomDrawQuestionRequest req) {
        return questionBankService.createRandomDraw(req);
    }

    @PutMapping("/random-draw-questions/{id}")
    public RandomDrawQuestionDto updateRandomDraw(@PathVariable String id, @RequestBody RandomDrawQuestionRequest req) {
        return questionBankService.updateRandomDraw(id, req);
    }

    @DeleteMapping("/random-draw-questions/{id}")
    public Map<String, String> deleteRandomDraw(@PathVariable String id) {
        return Map.of("id", questionBankService.deleteRandomDraw(id));
    }
}
