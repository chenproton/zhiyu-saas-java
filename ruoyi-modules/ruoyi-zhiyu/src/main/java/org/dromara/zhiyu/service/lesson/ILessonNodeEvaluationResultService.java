package org.dromara.zhiyu.service.lesson;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.GradeNodeResultRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeEvaluationResultDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.SubmitNodeEvaluationResultRequest;

/**
 * 节点测评结果服务（对齐 Go node_evaluation_result_handler.go + service/node_evaluation_result.go 语义）。
 *
 * @author zhiyu
 */
public interface ILessonNodeEvaluationResultService {

    /** 节点测评结果列表（nodeId/evaluateeId 过滤；学生仅本人）。 */
    ListResponse<NodeEvaluationResultDto> list(String nodeId, String evaluateeId, long limit, long offset);

    /** 课程下全部节点的测评结果（教师评分列表，学生无权）。 */
    ListResponse<NodeEvaluationResultDto> listByCourse(String courseId);

    /** 查询单条（教师评分详情，学生无权）。 */
    NodeEvaluationResultDto get(String id);

    /** 评分（pending→evaluated，学生无权）。 */
    boolean grade(String id, GradeNodeResultRequest req);

    /** 提交节点测评结果（幂等 upsert）。 */
    NodeEvaluationResultDto submit(SubmitNodeEvaluationResultRequest req);
}
