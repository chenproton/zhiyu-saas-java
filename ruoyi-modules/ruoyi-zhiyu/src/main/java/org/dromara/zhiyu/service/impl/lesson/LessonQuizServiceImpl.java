package org.dromara.zhiyu.service.impl.lesson;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateQuizRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeQuizDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeQuizQuestionDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.QuizQuestionRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.UpdateQuizRequest;
import org.dromara.zhiyu.domain.lesson.LessonNodeQuiz;
import org.dromara.zhiyu.domain.lesson.LessonNodeQuizQuestion;
import org.dromara.zhiyu.mapper.lesson.LessonNodeQuizMapper;
import org.dromara.zhiyu.mapper.lesson.LessonNodeQuizQuestionMapper;
import org.dromara.zhiyu.mapper.lesson.SystemCourseNodeMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.lesson.ILessonQuizService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 节点测验服务实现（对齐 Go node_quiz_handler.go + store/node_quizzes.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LessonQuizServiceImpl implements ILessonQuizService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    private final SystemGuard systemGuard;
    private final LessonNodeQuizMapper quizMapper;
    private final LessonNodeQuizQuestionMapper questionMapper;
    private final SystemCourseNodeMapper nodeMapper;

    @Override
    public ListResponse<NodeQuizDto> listQuizzes(String nodeId) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        List<LessonNodeQuiz> rows = quizMapper.selectQuizzes(tenantId, nodeId);
        List<NodeQuizDto> items = rows.stream().map(this::toQuizDto).toList();
        return ListResponse.of(items, items.size());
    }

    @Override
    public NodeQuizDto createQuiz(CreateQuizRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (isBlank(req.getNodeId()) || isBlank(req.getTitle()) || isBlank(req.getType())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        verifyNodeTenant(req.getNodeId(), tenantId);
        String id = UUID.randomUUID().toString();
        quizMapper.insertQuiz(id, tenantId, req.getNodeId(), req.getTitle(), req.getType(), req.getTimeLimit());
        return toQuizDto(quizMapper.selectQuiz(id, tenantId));
    }

    @Override
    public NodeQuizDto updateQuiz(String id, UpdateQuizRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (isBlank(req.getTitle()) || isBlank(req.getType())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (quizMapper.selectQuiz(id, tenantId) == null) {
            throw new ApiException(404, "not_found", "测验不存在");
        }
        quizMapper.updateQuiz(id, tenantId, req.getTitle(), req.getType(), req.getTimeLimit());
        return toQuizDto(quizMapper.selectQuiz(id, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deleteQuiz(String id) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (quizMapper.selectQuiz(id, tenantId) == null) {
            throw new ApiException(404, "not_found", "测验不存在");
        }
        questionMapper.deleteByQuiz(id, tenantId);
        quizMapper.deleteQuiz(id, tenantId);
        return id;
    }

    @Override
    public ListResponse<NodeQuizQuestionDto> listQuestions(String quizId, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (quizMapper.selectQuiz(quizId, tenantId) == null) {
            throw new ApiException(404, "not_found", "测验不存在");
        }
        int safeLimit = (int) systemGuard.clampLimit(limit, 500, 1000);
        int safeOffset = (int) Math.max(offset, 0);
        long total = questionMapper.countQuestions(quizId, tenantId);
        List<LessonNodeQuizQuestion> rows = questionMapper.selectQuestions(quizId, tenantId, safeLimit, safeOffset);
        List<NodeQuizQuestionDto> items = rows.stream().map(this::toQuestionDto).toList();
        return ListResponse.of(items, total);
    }

    @Override
    public NodeQuizQuestionDto addQuestion(String quizId, QuizQuestionRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (isBlank(req.getType()) || isBlank(req.getQuestion())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (quizMapper.selectQuiz(quizId, tenantId) == null) {
            throw new ApiException(404, "not_found", "测验不存在");
        }
        String id = UUID.randomUUID().toString();
        questionMapper.insertQuestion(id, tenantId, quizId, req.getType(), req.getQuestion(),
            toJson(req.getOptions()), req.getAnswer(), req.getScore(), req.getSortOrder());
        return toQuestionDto(questionMapper.selectQuestion(id, tenantId));
    }

    @Override
    public NodeQuizQuestionDto updateQuestion(String questionId, QuizQuestionRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (isBlank(req.getType()) || isBlank(req.getQuestion())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (questionMapper.selectQuestion(questionId, tenantId) == null) {
            throw new ApiException(404, "not_found", "题目不存在");
        }
        questionMapper.updateQuestion(questionId, tenantId, req.getType(), req.getQuestion(),
            toJson(req.getOptions()), req.getAnswer(), req.getScore(), req.getSortOrder());
        return toQuestionDto(questionMapper.selectQuestion(questionId, tenantId));
    }

    @Override
    public String deleteQuestion(String questionId) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (questionMapper.selectQuestion(questionId, tenantId) == null) {
            throw new ApiException(404, "not_found", "题目不存在");
        }
        questionMapper.deleteQuestion(questionId, tenantId);
        return questionId;
    }

    private NodeQuizDto toQuizDto(LessonNodeQuiz q) {
        NodeQuizDto dto = new NodeQuizDto();
        dto.setId(q.getId());
        dto.setNodeId(q.getNodeId());
        dto.setTitle(q.getTitle());
        dto.setType(q.getType());
        dto.setTimeLimit(q.getTimeLimit());
        return dto;
    }

    private NodeQuizQuestionDto toQuestionDto(LessonNodeQuizQuestion q) {
        NodeQuizQuestionDto dto = new NodeQuizQuestionDto();
        dto.setId(q.getId());
        dto.setQuizId(q.getQuizId());
        dto.setType(q.getType());
        dto.setQuestion(q.getQuestion());
        dto.setOptions(fromJson(q.getOptions()));
        dto.setAnswer(q.getAnswer());
        dto.setScore(q.getScore());
        dto.setSortOrder(q.getSortOrder());
        return dto;
    }

    private void verifyNodeTenant(String nodeId, String tenantId) {
        String nodeTenantId = nodeMapper.selectTenantId(nodeId);
        if (nodeTenantId == null || !nodeTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "课程节点不存在");
        }
    }

    private String toJson(Map<String, Object> map) {
        try {
            return MAPPER.writeValueAsString(map == null ? Map.of() : map);
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "选项格式不正确");
        }
    }

    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> v = MAPPER.readValue(json, MAP_REF);
            return v == null ? new LinkedHashMap<>() : v;
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

}
