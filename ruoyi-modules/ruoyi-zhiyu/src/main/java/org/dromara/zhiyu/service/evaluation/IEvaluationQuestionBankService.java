package org.dromara.zhiyu.service.evaluation;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateQuestionBankRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateQuestionRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.QuestionBankDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.QuestionDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.RandomDrawQuestionDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.RandomDrawQuestionRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ReviewRequest;

import java.util.List;
import java.util.Map;

/**
 * 题库/题目/随机抽题服务，对齐 Go QuestionBankHandler + QuestionHandler +
 * RandomDrawQuestionHandler。
 *
 * @author zhiyu
 */
public interface IEvaluationQuestionBankService {

    // ---------- 题库 question-banks ----------

    ListResponse<QuestionBankDto> listBanks(String search, String status, long limit, long offset);

    QuestionBankDto getBank(String id);

    QuestionBankDto createBank(CreateQuestionBankRequest req);

    QuestionBankDto updateBank(String id, CreateQuestionBankRequest req);

    String deleteBank(String id);

    QuestionBankDto submitBank(String id);

    QuestionBankDto reviewBank(String id, ReviewRequest req);

    QuestionBankDto publishBank(String id);

    QuestionBankDto archiveBank(String id);

    QuestionBankDto unpublishBank(String id);

    QuestionBankDto withdrawBank(String id);

    QuestionBankDto saveDraftBank(String id);

    QuestionBankDto inviteBank(String id, InviteRequest req);

    Map<String, Object> bankSnapshot(String id, String version);

    // ---------- 题目 questions ----------

    ListResponse<QuestionDto> listQuestions(String search, String bankId, String type, String status,
                                            long limit, long offset);

    QuestionDto getQuestion(String id);

    QuestionDto createQuestion(CreateQuestionRequest req);

    QuestionDto updateQuestion(String id, CreateQuestionRequest req);

    String deleteQuestion(String id);

    int batchCreateQuestions(String bankId, List<CreateQuestionRequest> items);

    // ---------- 随机抽题 random-draw-questions ----------

    ListResponse<RandomDrawQuestionDto> listRandomDraw(String search, String majorId, long limit, long offset);

    RandomDrawQuestionDto getRandomDraw(String id);

    RandomDrawQuestionDto createRandomDraw(RandomDrawQuestionRequest req);

    RandomDrawQuestionDto updateRandomDraw(String id, RandomDrawQuestionRequest req);

    String deleteRandomDraw(String id);
}
