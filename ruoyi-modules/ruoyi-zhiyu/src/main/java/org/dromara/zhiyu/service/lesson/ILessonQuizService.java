package org.dromara.zhiyu.service.lesson;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateQuizRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeQuizDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeQuizQuestionDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.QuizQuestionRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.UpdateQuizRequest;

/**
 * 节点测验服务（对齐 Go node_quiz_handler.go + store/node_quizzes.go 语义）。
 *
 * @author zhiyu
 */
public interface ILessonQuizService {

    /** 测验列表（按 nodeId 过滤，无分页）。 */
    ListResponse<NodeQuizDto> listQuizzes(String nodeId);

    /** 创建测验。 */
    NodeQuizDto createQuiz(CreateQuizRequest req);

    /** 更新测验。 */
    NodeQuizDto updateQuiz(String id, UpdateQuizRequest req);

    /** 删除测验（级联题目）。 */
    String deleteQuiz(String id);

    /** 测验题目列表（sort_order 升序，limit/offset 分页）。 */
    ListResponse<NodeQuizQuestionDto> listQuestions(String quizId, long limit, long offset);

    /** 添加题目。 */
    NodeQuizQuestionDto addQuestion(String quizId, QuizQuestionRequest req);

    /** 更新题目。 */
    NodeQuizQuestionDto updateQuestion(String questionId, QuizQuestionRequest req);

    /** 删除题目。 */
    String deleteQuestion(String questionId);
}
