package org.dromara.zhiyu.service.impl.lesson;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.GradeNodeResultRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeEvaluationResultDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.SubmitNodeEvaluationResultRequest;
import org.dromara.zhiyu.domain.lesson.NodeEvaluationResult;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.lesson.NodeEvaluationResultMapper;
import org.dromara.zhiyu.mapper.lesson.SystemCourseNodeMapper;
import org.dromara.zhiyu.mapper.portal.PortalResourceSnapshotMapper;
import org.dromara.zhiyu.service.lesson.ILessonNodeEvaluationResultService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 节点测评结果服务实现（对齐 Go node_evaluation_result_handler.go + store/node_evaluation_results.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LessonNodeEvaluationResultServiceImpl implements ILessonNodeEvaluationResultService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    private final NodeEvaluationResultMapper resultMapper;
    private final SystemCourseNodeMapper nodeMapper;
    private final PortalResourceSnapshotMapper snapshotMapper;
    private final ZhiyuUserMapper userMapper;

    @Override
    public ListResponse<NodeEvaluationResultDto> list(String nodeId, String evaluateeId, long limit, long offset) {
        requireUser();
        String tenantId = requireTenant();
        if (nodeId == null || nodeId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少节点ID");
        }
        long safeLimit = clampLimit(limit, 20);
        long safeOffset = Math.max(offset, 0);

        LambdaQueryBuilder<NodeEvaluationResult> wrapper = QueryBuilder.lambda(NodeEvaluationResult.class)
            .eq(NodeEvaluationResult::getTenantId, tenantId)
            .eq(NodeEvaluationResult::getNodeId, nodeId);
        if (isStudent()) {
            wrapper.eq(NodeEvaluationResult::getEvaluateeId, TenantContext.getUserId());
        } else if (evaluateeId != null && !evaluateeId.isEmpty()) {
            wrapper.eq(NodeEvaluationResult::getEvaluateeId, evaluateeId);
        }
        long total = resultMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(NodeEvaluationResult::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<NodeEvaluationResult> rows = resultMapper.selectList(wrapper.build());
        return ListResponse.of(rows.stream().map(this::toDto).toList(), total);
    }

    @Override
    public ListResponse<NodeEvaluationResultDto> listByCourse(String courseId) {
        requireUser();
        String tenantId = requireTenant();
        denyStudent("学生无权查看评分列表");
        if (courseId == null || courseId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少课程ID");
        }
        List<NodeEvaluationResult> rows = resultMapper.selectByCourse(tenantId, courseId);
        List<NodeEvaluationResultDto> items = rows.stream().map(this::toDto).toList();
        return ListResponse.of(items, items.size());
    }

    @Override
    public NodeEvaluationResultDto get(String id) {
        requireUser();
        denyStudent("学生无权查看评分详情");
        String tenantId = requireTenant();
        return toDto(fetchOwned(id, tenantId));
    }

    @Override
    public boolean grade(String id, GradeNodeResultRequest req) {
        String graderId = requireUser();
        denyStudent("学生无权评分");
        String tenantId = requireTenant();
        fetchOwned(id, tenantId);
        int rows = resultMapper.grade(id, tenantId, graderId, req.getScore(), req.getComment(),
            toJson(req.getEvalPointScores()));
        if (rows == 0) {
            throw new ApiException(409, "conflict", "评价结果已评分或不存在，请刷新后重试");
        }
        return true;
    }

    @Override
    public NodeEvaluationResultDto submit(SubmitNodeEvaluationResultRequest req) {
        requireUser();
        String tenantId = requireTenant();
        if (req.getNodeId() == null || req.getNodeId().isEmpty()
            || req.getMethodKey() == null || req.getMethodKey().isEmpty()
            || req.getEvaluateeId() == null || req.getEvaluateeId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段（nodeId、methodKey、evaluateeId）");
        }
        boolean student = isStudent();
        if (student && !req.getEvaluateeId().equals(TenantContext.getUserId())) {
            throw new ApiException(403, "forbidden", "仅可提交本人的节点测评结果");
        }
        BigDecimal maxScore = req.getMaxScore() == null || req.getMaxScore().compareTo(BigDecimal.ZERO) == 0
            ? new BigDecimal("100") : req.getMaxScore();
        String evaluatorId = emptyToNull(req.getEvaluatorId());
        if (student && evaluatorId != null && !evaluatorId.equals(TenantContext.getUserId())) {
            throw new ApiException(403, "forbidden", "学生仅可提交本人为评价人的评价结果");
        }
        if (evaluatorId != null) {
            ZhiyuUser evaluator = userMapper.selectById(evaluatorId);
            if (evaluator == null || evaluator.getTenantId() == null || !evaluator.getTenantId().equals(tenantId)) {
                throw new ApiException(403, "forbidden", "无权操作：评价人不属于您的租户");
            }
        }
        String version = null;
        String courseId = nodeMapper.selectCourseIdOf(req.getNodeId());
        if (courseId != null) {
            version = resolveVersion(tenantId, courseId, req.getExpectedVersion());
        }
        String id = resultMapper.upsertResult(tenantId, req.getNodeId(), req.getMethodKey(), req.getEvaluateeId(),
            evaluatorId, emptyToNull(req.getEvaluatorType()), maxScore, toJson(req.getEvalPointScores()),
            toJson(req.getObjectiveAnswers()), toJson(req.getSubjectiveContent()), toJson(req.getDrawnQuestions()),
            version);
        if (id == null) {
            throw new ApiException(409, "conflict", "评价结果已被评分，无法重新提交");
        }
        return toDto(fetchOwned(id, tenantId));
    }

    private String resolveVersion(String tenantId, String courseId, String expected) {
        if (expected != null && !expected.isEmpty()) {
            String data = snapshotMapper.selectSnapshotData(tenantId, "courses", courseId, expected);
            if (data != null) {
                return expected;
            }
        }
        String latest = snapshotMapper.selectLatestVersion(tenantId, "courses", courseId);
        if (latest != null && !latest.isEmpty()) {
            return latest;
        }
        PortalResourceSnapshotMapper.LiveStateRow live = snapshotMapper.selectCourseLiveState(tenantId, courseId);
        return live == null ? null : live.getVersion();
    }

    private NodeEvaluationResultDto toDto(NodeEvaluationResult r) {
        NodeEvaluationResultDto dto = new NodeEvaluationResultDto();
        dto.setId(r.getId());
        dto.setNodeId(r.getNodeId());
        dto.setMethodKey(r.getMethodKey());
        dto.setEvaluateeId(r.getEvaluateeId());
        dto.setEvaluatorId(r.getEvaluatorId());
        dto.setEvaluatorType(r.getEvaluatorType());
        dto.setStatus(r.getStatus());
        dto.setTotalScore(r.getTotalScore());
        dto.setMaxScore(r.getMaxScore());
        dto.setEvalPointScores(fromJson(r.getEvalPointScores()));
        dto.setObjectiveAnswers(fromJson(r.getObjectiveAnswers()));
        dto.setSubjectiveContent(fromJson(r.getSubjectiveContent()));
        dto.setDrawnQuestions(fromJson(r.getDrawnQuestions()));
        dto.setComment(r.getComment());
        dto.setGradedAt(r.getGradedAt());
        dto.setGradedBy(r.getGradedBy());
        dto.setVersion(r.getVersion());
        return dto;
    }

    private NodeEvaluationResult fetchOwned(String id, String tenantId) {
        NodeEvaluationResult r = resultMapper.selectOwned(id, tenantId);
        if (r == null) {
            throw new ApiException(404, "not_found", "评价结果不存在");
        }
        return r;
    }

    private void denyStudent(String msg) {
        if (isStudent()) {
            throw new ApiException(403, "forbidden", msg);
        }
    }

    private boolean isStudent() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            return false;
        }
        try {
            ZhiyuUser user = userMapper.selectById(userId);
            return user != null && "student".equals(user.getRole());
        } catch (Exception e) {
            return false;
        }
    }

    private String toJson(Map<String, Object> map) {
        try {
            return MAPPER.writeValueAsString(map == null ? Map.of() : map);
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "数据格式不正确");
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

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private long clampLimit(long limit, long defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }
}
