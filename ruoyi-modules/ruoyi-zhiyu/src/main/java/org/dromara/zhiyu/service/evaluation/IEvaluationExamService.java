package org.dromara.zhiyu.service.evaluation;

import org.dromara.zhiyu.core.page.ListResponse;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 试卷/考试安排/考试结果/场景测评结果服务，对齐 Go ExamHandler + ExamUsageHandler +
 * ExamResultHandler + EvaluationResultHandler + SnapshotHandler。
 *
 * @author zhiyu
 */
public interface IEvaluationExamService {

    // ---------- 试卷 exams ----------

    ListResponse<ExamDto> listExams(String search, String status, long limit, long offset);

    ExamDto getExam(String id);

    ExamDto createExam(CreateExamRequest req);

    ExamDto updateExam(String id, CreateExamRequest req);

    String deleteExam(String id);

    ExamDto submitExam(String id);

    ExamDto reviewExam(String id, ReviewRequest req);

    ExamDto publishExam(String id);

    ExamDto archiveExam(String id);

    ExamDto unpublishExam(String id);

    ExamDto withdrawExam(String id);

    ExamDto saveDraftExam(String id);

    ExamDto inviteExam(String id, InviteRequest req);

    ExamDto addExamQuestion(String id, String questionId, BigDecimal score);

    ExamDto removeExamQuestion(String id, String questionId);

    ExamDto updateExamQuestionScore(String examId, String questionId, UpdateExamQuestionScoreRequest req);

    ExamDto bulkUpdateExamScores(String examId, Map<String, BigDecimal> scores);

    Map<String, Object> examSnapshot(String id, String version);

    // ---------- 考试安排 exam-usages ----------

    ListResponse<ExamUsageDto> listExamUsages(String search, String examId, String status, String scope,
                                              long limit, long offset);

    ExamUsageDto getExamUsage(String id);

    ExamUsageDto createExamUsage(ExamUsageRequest req);

    ExamUsageDto updateExamUsage(String id, ExamUsageRequest req);

    String deleteExamUsage(String id);

    ExamUsageDto publishExamUsage(String id);

    ExamUsageDto finishExamUsage(String id);

    List<ExamCenterItemDto> examCenter();

    // ---------- 考试结果 exam-results ----------

    ListResponse<ExamResultDto> listExamResults(String usageId, long limit, long offset);

    ExamResultDto getExamResult(String id);

    ExamResultDto submitExamResult(SubmitExamResultRequest req);

    ExamResultDto gradeExamResult(String id, GradeExamResultRequest req);

    // ---------- 场景测评结果 results ----------

    ListResponse<SceneEvaluationResultDto> listResults(String taskId, String sceneId, String evaluateeId,
                                                       String methodKey, String status, long limit, long offset);

    SceneEvaluationResultDto getResult(String id);

    SceneEvaluationResultDto submitResult(SubmitResultRequest req);

    SceneEvaluationResultDto gradeResult(String id, GradeResultRequest req);

    int batchGradeResults(BatchGradeRequest req);
}
