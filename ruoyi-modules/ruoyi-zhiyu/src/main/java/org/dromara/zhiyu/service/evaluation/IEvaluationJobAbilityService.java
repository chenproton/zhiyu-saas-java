package org.dromara.zhiyu.service.evaluation;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CourseScoreItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilityAggregateLogDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilityAggregateRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilityResultItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilitySummaryItemDto;

import java.util.List;
import java.util.Map;

/**
 * 岗位能力结果服务（job-ability），对齐 Go JobAbilityResultHandler。
 *
 * @author zhiyu
 */
public interface IEvaluationJobAbilityService {

    ListResponse<JobAbilityResultItemDto> listResults(String careerPositionId, String userId, String search,
                                                      String grade, int page, int limit);

    JobAbilityResultItemDto getResult(String id);

    List<JobAbilitySummaryItemDto> summary();

    /** 学生课程成绩与排名（学生强制查本人）。 */
    ListResponse<CourseScoreItemDto> courseScores(String userId);

    Map<String, String> aggregate(JobAbilityAggregateRequest req);

    JobAbilityAggregateLogDto aggregateStatus(String careerPositionId, String logId);
}
