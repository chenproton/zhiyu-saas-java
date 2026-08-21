package org.dromara.zhiyu.service.impl.evaluation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.BatchGradeItem;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.BatchGradeRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateExamRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ExamCenterItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ExamDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ExamQuestionDto;
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
import org.dromara.zhiyu.domain.evaluation.EvaluationExamQuestion;
import org.dromara.zhiyu.domain.evaluation.EvaluationExamResult;
import org.dromara.zhiyu.domain.evaluation.EvaluationExamUsage;
import org.dromara.zhiyu.domain.evaluation.EvaluationQuestion;
import org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot;
import org.dromara.zhiyu.domain.evaluation.EvaluationSceneResult;
import org.dromara.zhiyu.domain.portal.PortalExam;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamQuestionMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamResultMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamUsageMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationQuestionMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationSceneResultMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationSnapshotMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.evaluation.IEvaluationExamService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 试卷/考试安排/考试结果/场景测评结果服务实现（对齐 Go exam_handler.go +
 * exam_usage_handler.go + exam_result_handler.go + evaluation_result_handler.go +
 * content_actions.go + snapshot_handler.go 语义）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class EvaluationExamServiceImpl implements IEvaluationExamService {

    private static final String CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    /** 允许的状态流转（对齐 Go allowedStatusTransitions） */
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        "draft", Set.of("pending", "archived"),
        "rejected", Set.of("draft", "pending", "archived"),
        "pending", Set.of("draft", "approved", "rejected"),
        "approved", Set.of("draft", "published", "archived"),
        "published", Set.of("draft", "archived"),
        "archived", Set.of("draft")
    );

    /** 手动创建的考试安排目标类型（对齐 Go isManualTargetType） */
    private static final Set<String> MANUAL_TARGET_TYPES = Set.of("class", "major", "department", "public");

    private final SystemGuard systemGuard;
    private final EvaluationExamMapper examMapper;
    private final EvaluationExamQuestionMapper examQuestionMapper;
    private final EvaluationExamUsageMapper examUsageMapper;
    private final EvaluationExamResultMapper examResultMapper;
    private final EvaluationSceneResultMapper sceneResultMapper;
    private final EvaluationQuestionMapper questionMapper;
    private final EvaluationSnapshotMapper snapshotMapper;
    private final ZhiyuUserMapper userMapper;

    // ==================== 试卷 exams ====================

    @Override
    public ListResponse<ExamDto> listExams(String search, String status, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        boolean student = isStudent();
        String effectiveStatus = status;
        if (student) {
            // 学生列表仅见已发布试卷（对齐 Go forcePublishedForStudent）
            effectiveStatus = "published";
        }
        LambdaQueryBuilder<PortalExam> wrapper = QueryBuilder.lambda(PortalExam.class)
            .eq(PortalExam::getTenantId, tenantId)
            .eq(PortalExam::getIsTemp, false);
        if (search != null && !search.isBlank()) {
            String pattern = toLikePattern(search);
            wrapper.and(w -> w.apply("name LIKE {0} ESCAPE '\\'", pattern)
                .or().apply("description LIKE {0} ESCAPE '\\'", pattern));
        }
        if (effectiveStatus != null && !effectiveStatus.isBlank()) {
            wrapper.eq(PortalExam::getStatus, effectiveStatus);
        }
        long total = examMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(PortalExam::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<PortalExam> rows = examMapper.selectList(wrapper.build());
        return ListResponse.of(assembleExams(rows), total);
    }

    @Override
    public ExamDto getExam(String id) {
        systemGuard.requireUser();
        PortalExam exam = fetchExam(id);
        // 学生作答由服务端判分，不返回答案与解析；且仅可读已发布试卷（决策 7）
        boolean student = isStudent();
        if (student && !"published".equals(exam.getStatus())) {
            throw new ApiException(404, "not_found", "考试不存在");
        }
        ExamDto dto = assembleExam(exam);
        if (student && dto.getQuestions() != null) {
            for (ExamQuestionDto q : dto.getQuestions()) {
                q.setAnswer(null);
                q.setAnalysis(null);
            }
        }
        return dto;
    }

    @Override
    public ExamDto createExam(CreateExamRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String id = UUID.randomUUID().toString();
        String code = generateUniqueCode(tenantId, "SJ", examMapper::existsCode);
        String description = req.getDescription() == null || req.getDescription().isEmpty() ? null : req.getDescription();
        Integer duration = req.getDuration() != null && req.getDuration() > 0 ? req.getDuration() : null;
        examMapper.insertExam(id, tenantId, code, req.getName(), description, duration,
            emptyToNull(req.getCoverImage()), coalesce(req.getCollaboratorIds()),
            coalesce(req.getCollaboratorDeptIds()), emptyToNull(req.getBatchId()), userId,
            Boolean.TRUE.equals(req.getIsTemp()));
        return assembleExam(fetchExam(id));
    }

    @Override
    public ExamDto updateExam(String id, CreateExamRequest req) {
        systemGuard.requireUser();
        PortalExam existing = fetchExam(id);
        String tenantId = systemGuard.requireTenant();
        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        String description = req.getDescription() != null ? (req.getDescription().isEmpty() ? null : req.getDescription())
            : existing.getDescription();
        Integer duration = req.getDuration() != null && req.getDuration() > 0 ? req.getDuration() : existing.getDuration();
        String coverImage = req.getCoverImage() != null ? emptyToNull(req.getCoverImage()) : existing.getCoverImage();
        String batchId = req.getBatchId() != null ? emptyToNull(req.getBatchId()) : existing.getBatchId();
        List<String> collaboratorIds = req.getCollaboratorIds() != null ? coalesce(req.getCollaboratorIds())
            : coalesce(existing.getCollaboratorIds());
        List<String> collaboratorDeptIds = req.getCollaboratorDeptIds() != null ? coalesce(req.getCollaboratorDeptIds())
            : coalesce(existing.getCollaboratorDeptIds());
        examMapper.updateExam(id, tenantId, name, description, duration, coverImage, collaboratorIds,
            collaboratorDeptIds, batchId);
        return assembleExam(fetchExam(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deleteExam(String id) {
        systemGuard.requireUser();
        fetchExam(id);
        String tenantId = systemGuard.requireTenant();
        if (examMapper.examHasResults(id)) {
            throw new ApiException(409, "conflict", "该试卷已存在考试结果，无法删除");
        }
        examQuestionMapper.delete(QueryBuilder.lambda(EvaluationExamQuestion.class)
            .eq(EvaluationExamQuestion::getExamId, id)
            .eq(EvaluationExamQuestion::getTenantId, tenantId).build());
        examMapper.delete(QueryBuilder.lambda(PortalExam.class)
            .eq(PortalExam::getId, id).eq(PortalExam::getTenantId, tenantId).build());
        return id;
    }

    // ---------- 状态流转 / 审核 / 邀请 ----------

    @Override
    public ExamDto submitExam(String id) {
        return transition(id, "pending");
    }

    @Override
    public ExamDto reviewExam(String id, ReviewRequest req) {
        systemGuard.requireUser();
        String toStatus;
        if ("approved".equals(req.getStatus())) {
            toStatus = "approved";
        } else if ("rejected".equals(req.getStatus())) {
            toStatus = "rejected";
        } else {
            throw new ApiException(400, "bad_request", "无效的审核状态");
        }
        fetchExam(id);
        String tenantId = systemGuard.requireTenant();
        int rows = examMapper.casTransition(id, tenantId, "pending", toStatus);
        if (rows == 0) {
            throw new ApiException(400, "bad_request", "考试不存在或不在待处理状态");
        }
        return assembleExam(fetchExam(id));
    }

    @Override
    public ExamDto publishExam(String id) {
        return transition(id, "published");
    }

    @Override
    public ExamDto archiveExam(String id) {
        return transition(id, "archived");
    }

    @Override
    public ExamDto unpublishExam(String id) {
        return transition(id, "draft");
    }

    @Override
    public ExamDto withdrawExam(String id) {
        return transition(id, "draft");
    }

    @Override
    public ExamDto saveDraftExam(String id) {
        return transition(id, "draft");
    }

    @Override
    public ExamDto inviteExam(String id, InviteRequest req) {
        systemGuard.requireUser();
        fetchExam(id);
        if (req.getUserId() == null || req.getUserId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        String tenantId = systemGuard.requireTenant();
        if (!userInTenant(req.getUserId(), tenantId)) {
            throw new ApiException(400, "bad_request", "用户不存在或不属于本租户");
        }
        examMapper.inviteCollaborator(id, req.getUserId());
        return assembleExam(fetchExam(id));
    }

    @Transactional(rollbackFor = Exception.class)
    protected ExamDto transition(String id, String toStatus) {
        systemGuard.requireUser();
        PortalExam exam = fetchExam(id);
        String tenantId = systemGuard.requireTenant();
        String currentStatus = exam.getStatus();
        Set<String> allowed = ALLOWED_TRANSITIONS.get(currentStatus);
        if (allowed == null || !allowed.contains(toStatus)) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作（试卷）");
        }
        int rows = examMapper.casTransition(id, tenantId, currentStatus, toStatus);
        if (rows == 0) {
            throw new ApiException(500, "internal_error", "状态流转失败");
        }
        if ("pending".equals(currentStatus) && "draft".equals(toStatus)) {
            examMapper.deletePendingApproval("exam", id);
        }
        if ("published".equals(toStatus)) {
            String version = nextVersion(exam.getVersion());
            examMapper.bumpVersion(id, tenantId, version);
            saveExamSnapshot(tenantId, id, version);
        }
        return assembleExam(fetchExam(id));
    }

    // ---------- 试卷题目 ----------

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ExamDto addExamQuestion(String id, String questionId, BigDecimal score) {
        systemGuard.requireUser();
        PortalExam exam = fetchExam(id);
        String tenantId = systemGuard.requireTenant();
        if (questionId == null || questionId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少题目ID");
        }
        EvaluationQuestion q = questionMapper.selectOne(QueryBuilder.lambda(EvaluationQuestion.class)
            .eq(EvaluationQuestion::getId, questionId)
            .eq(EvaluationQuestion::getTenantId, tenantId).build());
        if (q == null) {
            throw new ApiException(404, "not_found", "题目不存在");
        }
        BigDecimal effScore = (score == null || score.signum() == 0) ? q.getScore() : score;
        insertExamQuestion(tenantId, id, q, effScore);
        examQuestionMapper.recalcExamTotal(id, tenantId);
        return assembleExam(fetchExam(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ExamDto removeExamQuestion(String id, String questionId) {
        systemGuard.requireUser();
        fetchExam(id);
        String tenantId = systemGuard.requireTenant();
        examQuestionMapper.delete(QueryBuilder.lambda(EvaluationExamQuestion.class)
            .eq(EvaluationExamQuestion::getExamId, id)
            .eq(EvaluationExamQuestion::getQuestionId, questionId)
            .eq(EvaluationExamQuestion::getTenantId, tenantId).build());
        examQuestionMapper.recalcExamTotal(id, tenantId);
        return assembleExam(fetchExam(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ExamDto updateExamQuestionScore(String examId, String questionId, UpdateExamQuestionScoreRequest req) {
        systemGuard.requireUser();
        fetchExam(examId);
        String tenantId = systemGuard.requireTenant();
        if (req.getScore() == null || req.getScore().signum() <= 0) {
            throw new ApiException(400, "bad_request", "分数必须为正数");
        }
        int rows = examQuestionMapper.updateScore(examId, questionId, tenantId, req.getScore());
        if (rows == 0) {
            throw new ApiException(404, "not_found", "考试中未找到该题目");
        }
        examQuestionMapper.recalcExamTotal(examId, tenantId);
        return assembleExam(fetchExam(examId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ExamDto bulkUpdateExamScores(String examId, Map<String, BigDecimal> scores) {
        systemGuard.requireUser();
        fetchExam(examId);
        String tenantId = systemGuard.requireTenant();
        if (scores == null || scores.isEmpty()) {
            throw new ApiException(400, "bad_request", "分数映射不能为空");
        }
        List<String> ids = new ArrayList<>();
        List<Double> vals = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> e : scores.entrySet()) {
            if (e.getValue() == null || e.getValue().signum() <= 0) {
                throw new ApiException(400, "bad_request", "分数必须为正数");
            }
            ids.add(e.getKey());
            vals.add(e.getValue().doubleValue());
        }
        if (!ids.isEmpty()) {
            examQuestionMapper.bulkUpdateScores(ids, vals, examId, tenantId);
        }
        examQuestionMapper.recalcExamTotal(examId, tenantId);
        return assembleExam(fetchExam(examId));
    }

    private void insertExamQuestion(String tenantId, String examId, EvaluationQuestion q, BigDecimal score) {
        examQuestionMapper.insertExamQuestion(UUID.randomUUID().toString(), tenantId, examId, q.getId(), q.getType(),
            q.getContent(), q.getOptions(), q.getAnswer(), q.getAnalysis(), score);
    }

    @Override
    public Map<String, Object> examSnapshot(String id, String version) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        Map<String, Object> bundle = getExamBundle(tenantId, id, version);
        if (bundle == null) {
            throw new ApiException(404, "not_found", "资源不存在或未发布");
        }
        if (isStudent()) {
            stripAnswers(bundle, "exam_questions", "answer", "analysis");
        }
        return bundle;
    }

    // ==================== 考试安排 exam-usages ====================

    @Override
    public ListResponse<ExamUsageDto> listExamUsages(String search, String examId, String status, String scope,
                                                     long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        // 读路径定时启停懒更新（对齐 Go SyncScheduledExamUsageStatus）
        try {
            examUsageMapper.syncScheduledExamUsageStatus(tenantId, OffsetDateTime.now());
        } catch (Exception ignored) {
            // 懒更新失败不阻断列表
        }
        LambdaQueryBuilder<EvaluationExamUsage> wrapper = QueryBuilder.lambda(EvaluationExamUsage.class)
            .eq(EvaluationExamUsage::getTenantId, tenantId);
        if (!"all".equals(scope)) {
            // 默认展示范围：手动创建的 + 自动创建且定时/手动启停的
            wrapper.and(w -> w.in(EvaluationExamUsage::getTargetType, new ArrayList<>(MANUAL_TARGET_TYPES))
                .or(o -> o.in(EvaluationExamUsage::getTargetType, List.of("task", "node"))
                    .in(EvaluationExamUsage::getActivationMode, List.of("manual", "scheduled"))));
        }
        if (search != null && !search.isBlank()) {
            wrapper.apply("name LIKE {0} ESCAPE '\\'", toLikePattern(search));
        }
        if (examId != null && !examId.isBlank()) {
            wrapper.eq(EvaluationExamUsage::getExamId, examId);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(EvaluationExamUsage::getStatus, status);
        }
        long total = examUsageMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationExamUsage::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationExamUsage> rows = examUsageMapper.selectList(wrapper.build());
        return ListResponse.of(rows.stream().map(this::toExamUsageDto).toList(), total);
    }

    @Override
    public ExamUsageDto getExamUsage(String id) {
        systemGuard.requireUser();
        return toExamUsageDto(fetchExamUsage(id));
    }

    @Override
    public ExamUsageDto createExamUsage(ExamUsageRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getExamId() == null || req.getExamId().isEmpty() || req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 校验试卷归属当前租户（防引用他租户试卷的跨租户读链）
        String examTenantId = examUsageMapper.examTenantId(req.getExamId());
        if (examTenantId == null || !examTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "考试安排不存在");
        }
        String status = "draft";
        if ("always".equals(req.getActivationMode())) {
            status = "published";
        }
        String examVersion = resolveExamVersion(tenantId, req.getExamId());
        String id = UUID.randomUUID().toString();
        examUsageMapper.insertUsage(id, tenantId, req.getExamId(), req.getName(), emptyToNull(req.getDescription()),
            req.getStartTime(), req.getEndTime(), req.getDuration(), emptyToNull(req.getTargetType()),
            coalesce(req.getTargetIds()), status, req.getActivationMode() == null ? "manual" : req.getActivationMode(),
            userId, examVersion);
        return toExamUsageDto(fetchExamUsage(id));
    }

    @Override
    public ExamUsageDto updateExamUsage(String id, ExamUsageRequest req) {
        systemGuard.requireUser();
        fetchExamUsage(id);
        String tenantId = systemGuard.requireTenant();
        // 自动创建的考试安排不允许编辑（对齐 Go manualOnly）
        EvaluationExamUsage usage = fetchExamUsage(id);
        if (usage.getTargetType() == null || !MANUAL_TARGET_TYPES.contains(usage.getTargetType())) {
            throw new ApiException(403, "forbidden", "自动创建的考试安排不允许编辑/删除");
        }
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String activationMode = req.getActivationMode() == null || req.getActivationMode().isEmpty()
            ? usage.getActivationMode() : req.getActivationMode();
        examUsageMapper.updateUsage(id, tenantId, req.getName(), emptyToNull(req.getDescription()),
            req.getStartTime(), req.getEndTime(), req.getDuration(), emptyToNull(req.getTargetType()),
            req.getTargetIds() != null ? coalesce(req.getTargetIds()) : usage.getTargetIds(), activationMode);
        return toExamUsageDto(fetchExamUsage(id));
    }

    @Override
    public String deleteExamUsage(String id) {
        systemGuard.requireUser();
        EvaluationExamUsage usage = fetchExamUsage(id);
        String tenantId = systemGuard.requireTenant();
        if (usage.getTargetType() == null || !MANUAL_TARGET_TYPES.contains(usage.getTargetType())) {
            throw new ApiException(403, "forbidden", "自动创建的考试安排不允许编辑/删除");
        }
        // 删除保护：存在成绩记录时拒绝删除
        if (examResultMapper.selectCount(QueryBuilder.lambda(EvaluationExamResult.class)
            .eq(EvaluationExamResult::getExamUsageId, id).build()) > 0) {
            throw new ApiException(409, "conflict", "该考试安排已存在考试结果，无法删除");
        }
        examUsageMapper.delete(QueryBuilder.lambda(EvaluationExamUsage.class)
            .eq(EvaluationExamUsage::getId, id).eq(EvaluationExamUsage::getTenantId, tenantId).build());
        return id;
    }

    @Override
    public ExamUsageDto publishExamUsage(String id) {
        systemGuard.requireUser();
        EvaluationExamUsage usage = fetchExamUsage(id);
        String tenantId = systemGuard.requireTenant();
        if (!"draft".equals(usage.getStatus()) && !"pending".equals(usage.getStatus())) {
            throw new ApiException(400, "bad_request", "考试安排不在草稿状态");
        }
        examUsageMapper.setStatus(id, tenantId, "published");
        return toExamUsageDto(fetchExamUsage(id));
    }

    @Override
    public ExamUsageDto finishExamUsage(String id) {
        systemGuard.requireUser();
        EvaluationExamUsage usage = fetchExamUsage(id);
        String tenantId = systemGuard.requireTenant();
        if (!"published".equals(usage.getStatus()) && !"in_progress".equals(usage.getStatus())) {
            throw new ApiException(400, "bad_request", "考试安排不在已发布状态");
        }
        examUsageMapper.setStatus(id, tenantId, "finished");
        return toExamUsageDto(fetchExamUsage(id));
    }

    @Override
    public List<ExamCenterItemDto> examCenter() {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        boolean student = isStudent();
        String classNodeId = "";
        if (student) {
            classNodeId = examUsageMapper.userClassNodeId(userId);
        }
        try {
            examUsageMapper.syncScheduledExamUsageStatus(tenantId, OffsetDateTime.now());
        } catch (Exception e) {
            // 状态同步失败不阻断考试中心查询，但需留痕
            log.warn("同步考试安排状态失败 tenantId={}", tenantId, e);
        }
        List<Map<String, Object>> rows = examUsageMapper.selectExamCenter(tenantId, userId, classNodeId);
        List<ExamCenterItemDto> items = new ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) {
            ExamCenterItemDto dto = new ExamCenterItemDto();
            dto.setId(str(r.get("id")));
            dto.setExamId(str(r.get("exam_id")));
            dto.setUsageName(str(r.get("usage_name")));
            dto.setExamName(str(r.get("exam_name")));
            dto.setDescription(str(r.get("description")));
            dto.setStartTime(odt(r.get("start_time")));
            dto.setEndTime(odt(r.get("end_time")));
            dto.setDuration(intOrNull(r.get("duration")));
            dto.setStatus(str(r.get("status")));
            dto.setQuestionCount(intOrNull(r.get("question_count")));
            dto.setTotalScore(decOrNull(r.get("total_score")));
            dto.setParticipatable(student && boolOrFalse(r.get("class_match")));
            dto.setSubmitted(boolOrFalse(r.get("submitted")));
            dto.setScore(decOrNull(r.get("score")));
            dto.setStudentView(student);
            dto.setExamVersion(str(r.get("exam_version")));
            items.add(dto);
        }
        return items;
    }

    // ==================== 考试结果 exam-results ====================

    @Override
    public ListResponse<ExamResultDto> listExamResults(String usageId, long limit, long offset) {
        systemGuard.requireUser();
        if (usageId == null || usageId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少使用记录ID");
        }
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<EvaluationExamResult> wrapper = QueryBuilder.lambda(EvaluationExamResult.class)
            .eq(EvaluationExamResult::getTenantId, tenantId)
            .eq(EvaluationExamResult::getExamUsageId, usageId);
        // 学生仅可查看本人考试结果
        if (isStudent()) {
            wrapper.eq(EvaluationExamResult::getUserId, systemGuard.requireUser());
        }
        long total = examResultMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationExamResult::getScore)
            .orderByAsc(EvaluationExamResult::getSubmitTime)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationExamResult> rows = examResultMapper.selectList(wrapper.build());
        return ListResponse.of(assembleExamResults(rows), total);
    }

    @Override
    public ExamResultDto getExamResult(String id) {
        systemGuard.requireUser();
        EvaluationExamResult result = examResultMapper.selectOne(QueryBuilder.lambda(EvaluationExamResult.class)
            .eq(EvaluationExamResult::getId, id).build());
        if (result == null) {
            throw new ApiException(404, "not_found", "考试结果不存在");
        }
        String tenantId = systemGuard.requireTenant();
        if (result.getTenantId() == null || !result.getTenantId().equals(tenantId)) {
            throw new ApiException(404, "not_found", "考试结果不存在");
        }
        // 学生仅可查看本人考试结果
        if (isStudent() && !systemGuard.requireUser().equals(result.getUserId())) {
            throw new ApiException(404, "not_found", "考试结果不存在");
        }
        return toExamResultDto(result);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ExamResultDto submitExamResult(SubmitExamResultRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getExamUsageId() == null || req.getExamUsageId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少考试使用记录ID");
        }
        EvaluationExamUsage usage = fetchExamUsage(req.getExamUsageId());
        // 窗口校验：未到开始时间 / 已过结束时间禁止提交
        OffsetDateTime now = OffsetDateTime.now();
        if (usage.getStartTime() != null && now.isBefore(usage.getStartTime())) {
            throw new ApiException(409, "conflict", "考试尚未开始");
        }
        if (usage.getEndTime() != null && now.isAfter(usage.getEndTime())) {
            throw new ApiException(409, "conflict", "考试已结束");
        }
        // 重交保护：该方式的场景评价已由教师评分时拒绝覆盖
        if (examResultMapper.usageGradedByUser(req.getExamUsageId(), userId, req.getMethodKey())) {
            throw new ApiException(409, "conflict", "该测评已完成评分，无法重新提交");
        }
        if (examResultMapper.resultTeacherGraded(req.getExamUsageId(), userId)) {
            throw new ApiException(409, "conflict", "该测评已完成评分，无法重新提交");
        }
        // 重复作答控制：已提交过且不允许重复作答时拒绝
        if (examResultMapper.resultSubmitted(req.getExamUsageId(), userId)) {
            if (!examResultMapper.usageAllowRetake(req.getExamUsageId())) {
                throw new ApiException(409, "conflict", "该考试不允许重复作答");
            }
        }
        // 班级约束：班级类考试仅允许目标班级学生提交
        if ("class".equals(usage.getTargetType())) {
            String classNodeId = examUsageMapper.userClassNodeId(userId);
            if (classNodeId == null || classNodeId.isEmpty()
                || !examResultMapper.classTargetContains(req.getExamUsageId(), classNodeId)) {
                throw new ApiException(403, "forbidden", "该考试仅限指定班级参加");
            }
        }
        Map<String, Object> usageRef = examResultMapper.usageExamRef(req.getExamUsageId());
        if (usageRef == null) {
            throw new ApiException(404, "not_found", "考试安排不存在");
        }
        String examId = str(usageRef.get("exam_id"));
        String examVersion = str(usageRef.get("exam_version"));
        // 判分快照化：题目与总分按安排固化版本快照读取，缺档回退 live
        GradingData grading = fetchExamGradingData(tenantId, examId, examVersion);

        BigDecimal score = BigDecimal.ZERO;
        boolean hasSubjective = false;
        for (GradingQuestion q : grading.questions) {
            if ("fill".equals(q.type) || "essay".equals(q.type) || "short_answer".equals(q.type)) {
                hasSubjective = true;
                continue;
            }
            Object raw = req.getAnswers() == null ? null : req.getAnswers().get(q.id);
            if (raw == null) {
                continue;
            }
            if (isCorrect(q.type, q.answer, q.options, raw)) {
                score = score.add(q.score);
            }
        }
        boolean isPass = !hasSubjective && score.compareTo(grading.totalScore.multiply(new BigDecimal("0.6"))) >= 0;
        String gradingStatus = hasSubjective ? "pending" : "evaluated";

        Map<String, Object> profile = examResultMapper.fetchUserProfile(userId);
        if (profile == null) {
            throw new ApiException(500, "internal_error", "查询用户信息失败");
        }
        String majorName = str(profile.get("major_name"));
        String majorId = profile.get("major_id") == null ? null : String.valueOf(profile.get("major_id"));
        int rows = examResultMapper.saveResult(tenantId, req.getExamUsageId(), userId,
            str(profile.get("name")), str(profile.get("class_name")), "", majorId, score, grading.totalScore,
            isPass, toJson(req.getAnswers() == null ? Map.of() : req.getAnswers()), gradingStatus);
        if (rows == 0) {
            throw new ApiException(409, "conflict", "该测评已完成评分，无法重新提交");
        }
        // 同步场景/课程/节点统一评价（同一事务）
        String answersJson = toJson(req.getAnswers() == null ? Map.of() : req.getAnswers());
        examResultMapper.syncSceneEvaluation(tenantId, req.getExamUsageId(), userId, score, grading.totalScore,
            answersJson, hasSubjective ? "pending" : "evaluated", req.getMethodKey());
        examResultMapper.syncCourseEvaluation(tenantId, req.getExamUsageId(), userId, score, grading.totalScore,
            answersJson, hasSubjective ? "pending" : "evaluated", req.getMethodKey());
        examResultMapper.syncNodeEvaluation(tenantId, req.getExamUsageId(), userId, score, grading.totalScore,
            answersJson, hasSubjective ? "pending" : "evaluated", req.getMethodKey());
        EvaluationExamResult saved = examResultMapper.selectOne(QueryBuilder.lambda(EvaluationExamResult.class)
            .eq(EvaluationExamResult::getExamUsageId, req.getExamUsageId())
            .eq(EvaluationExamResult::getUserId, userId).build());
        ExamResultDto dto = toExamResultDto(saved);
        dto.setMajorName(majorName.isEmpty() ? null : majorName);
        return dto;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ExamResultDto gradeExamResult(String id, GradeExamResultRequest req) {
        systemGuard.requireUser();
        EvaluationExamResult result = examResultMapper.selectOne(QueryBuilder.lambda(EvaluationExamResult.class)
            .eq(EvaluationExamResult::getId, id).build());
        if (result == null || result.getTenantId() == null) {
            throw new ApiException(404, "not_found", "考试结果不存在");
        }
        String tenantId = result.getTenantId();
        // 仅手动创建的考试安排支持评分（对齐 Go isManualExamUsageTargetType）
        EvaluationExamUsage usage = examUsageMapper.selectOne(QueryBuilder.lambda(EvaluationExamUsage.class)
            .eq(EvaluationExamUsage::getId, result.getExamUsageId()).build());
        if (usage == null || usage.getTargetType() == null || !MANUAL_TARGET_TYPES.contains(usage.getTargetType())) {
            throw new ApiException(403, "forbidden", "该考试安排不支持评分");
        }
        Map<String, Object> usageRef = examResultMapper.usageExamRef(result.getExamUsageId());
        String examId = usageRef == null ? "" : str(usageRef.get("exam_id"));
        String examVersion = usageRef == null ? "" : str(usageRef.get("exam_version"));
        GradingData grading = fetchExamGradingData(tenantId, examId, examVersion);
        // 客观分按存储答案重算
        BigDecimal objective = BigDecimal.ZERO;
        Map<String, Object> answers = parseJsonMap(result.getAnswers());
        for (GradingQuestion q : grading.questions) {
            if ("fill".equals(q.type) || "essay".equals(q.type) || "short_answer".equals(q.type)) {
                continue;
            }
            Object raw = answers.get(q.id);
            if (raw == null) {
                continue;
            }
            if (isCorrect(q.type, q.answer, q.options, raw)) {
                objective = objective.add(q.score);
            }
        }
        // 主观题分数由教师提交
        BigDecimal subjective = BigDecimal.ZERO;
        if (req.getScores() != null) {
            for (Object v : req.getScores().values()) {
                if (v instanceof Number n) {
                    subjective = subjective.add(new BigDecimal(n.toString()));
                } else if (v instanceof Map<?, ?> m && m.get("score") instanceof Number n) {
                    subjective = subjective.add(new BigDecimal(n.toString()));
                }
            }
        }
        BigDecimal score = roundScore(objective.add(subjective));
        boolean isPass = score.compareTo(grading.totalScore.multiply(new BigDecimal("0.6"))) >= 0;
        int rows = examResultMapper.grade(id, tenantId, systemGuard.requireUser(), score, isPass,
            toJson(req.getScores() == null ? Map.of() : req.getScores()), emptyToNull(req.getComment()));
        if (rows == 0) {
            throw new ApiException(404, "not_found", "考试结果不存在");
        }
        return toExamResultDto(examResultMapper.selectOne(QueryBuilder.lambda(EvaluationExamResult.class)
            .eq(EvaluationExamResult::getId, id).build()));
    }

    // ==================== 场景测评结果 results ====================

    @Override
    public ListResponse<SceneEvaluationResultDto> listResults(String taskId, String sceneId, String evaluateeId,
                                                              String methodKey, String status, long limit, long offset) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        boolean student = isStudent();
        LambdaQueryBuilder<EvaluationSceneResult> wrapper = QueryBuilder.lambda(EvaluationSceneResult.class)
            .eq(EvaluationSceneResult::getTenantId, tenantId);
        if (student) {
            // 学生仅可查看本人的评价结果
            wrapper.eq(EvaluationSceneResult::getEvaluateeId, systemGuard.requireUser());
            if (taskId != null && !taskId.isBlank()) {
                wrapper.eq(EvaluationSceneResult::getTaskId, taskId);
            }
            if (sceneId != null && !sceneId.isBlank()) {
                wrapper.eq(EvaluationSceneResult::getSceneId, sceneId);
            }
        } else {
            if (taskId != null && !taskId.isBlank()) {
                wrapper.eq(EvaluationSceneResult::getTaskId, taskId);
            }
            if (sceneId != null && !sceneId.isBlank()) {
                wrapper.eq(EvaluationSceneResult::getSceneId, sceneId);
            }
            if (methodKey != null && !methodKey.isBlank()) {
                wrapper.eq(EvaluationSceneResult::getMethodKey, methodKey);
            }
            if (evaluateeId != null && !evaluateeId.isBlank()) {
                wrapper.eq(EvaluationSceneResult::getEvaluateeId, evaluateeId);
            }
            if (status != null && !status.isBlank()) {
                wrapper.eq(EvaluationSceneResult::getStatus, status);
            }
        }
        long total = sceneResultMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationSceneResult::getId)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationSceneResult> rows = sceneResultMapper.selectList(wrapper.build());
        return ListResponse.of(rows.stream().map(this::toSceneResultDto).toList(), total);
    }

    @Override
    public SceneEvaluationResultDto getResult(String id) {
        systemGuard.requireUser();
        EvaluationSceneResult res = sceneResultMapper.selectOne(QueryBuilder.lambda(EvaluationSceneResult.class)
            .eq(EvaluationSceneResult::getId, id).build());
        if (res == null || res.getTenantId() == null) {
            throw new ApiException(404, "not_found", "评价结果不存在");
        }
        String tenantId = systemGuard.requireTenant();
        if (!res.getTenantId().equals(tenantId)) {
            throw new ApiException(404, "not_found", "评价结果不存在");
        }
        // 学生仅可查看本人的评价结果
        if (isStudent() && !systemGuard.requireUser().equals(res.getEvaluateeId())) {
            throw new ApiException(404, "not_found", "评价结果不存在");
        }
        return toSceneResultDto(res);
    }

    @Override
    public SceneEvaluationResultDto submitResult(SubmitResultRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getTaskId() == null || req.getTaskId().isEmpty() || req.getMethodKey() == null || req.getMethodKey().isEmpty()
            || req.getEvaluateeId() == null || req.getEvaluateeId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段（taskId、methodKey、evaluateeId）");
        }
        // 学生仅可提交本人的评价结果，评价人只能是本人
        boolean student = isStudent();
        if (student && !req.getEvaluateeId().equals(userId)) {
            throw new ApiException(403, "forbidden", "仅可提交本人的评价结果");
        }
        if (req.getEvaluatorId() != null && !req.getEvaluatorId().isEmpty()
            && !userInTenant(req.getEvaluatorId(), tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：评价人不属于您的租户");
        }
        if (student && req.getEvaluatorId() != null && !req.getEvaluatorId().isEmpty()
            && !req.getEvaluatorId().equals(userId)) {
            throw new ApiException(403, "forbidden", "学生仅可提交本人为评价人的评价结果");
        }
        BigDecimal maxScore = req.getMaxScore() == null || req.getMaxScore().signum() == 0
            ? new BigDecimal("100") : req.getMaxScore();
        String evaluatorId = req.getEvaluatorId() == null || req.getEvaluatorId().isEmpty() ? null : req.getEvaluatorId();
        // scene_id 与 version 均以服务端解析为准
        String sceneId = sceneResultMapper.scenarioIdByTask(req.getTaskId());
        String version = "";
        if (sceneId != null) {
            version = expectedOrLatestVersion(tenantId, sceneId, req.getExpectedVersion());
        }
        EvaluationSceneResult entity = new EvaluationSceneResult();
        entity.setTenantId(tenantId);
        entity.setTaskId(req.getTaskId());
        entity.setSceneId(sceneId);
        entity.setMethodKey(req.getMethodKey());
        entity.setEvaluateeId(req.getEvaluateeId());
        entity.setEvaluatorId(evaluatorId);
        entity.setEvaluatorType(emptyToNull(req.getEvaluatorType()));
        entity.setStatus("pending");
        entity.setMaxScore(maxScore);
        entity.setEvalPointScores(toJson(req.getEvalPointScores() == null ? Map.of() : req.getEvalPointScores()));
        entity.setObjectiveAnswers(toJson(req.getObjectiveAnswers() == null ? Map.of() : req.getObjectiveAnswers()));
        entity.setSubjectiveContent(toJson(req.getSubjectiveContent() == null ? Map.of() : req.getSubjectiveContent()));
        entity.setDrawnQuestions(toJson(req.getDrawnQuestions() == null ? Map.of() : req.getDrawnQuestions()));
        entity.setVersion(version.isEmpty() ? null : version);
        int rows = sceneResultMapper.upsertSubmit(entity);
        if (rows == 0) {
            throw new ApiException(409, "conflict", "评价结果已被评分，无法重新提交");
        }
        EvaluationSceneResult saved = sceneResultMapper.selectOne(QueryBuilder.lambda(EvaluationSceneResult.class)
            .eq(EvaluationSceneResult::getTenantId, tenantId)
            .eq(EvaluationSceneResult::getTaskId, req.getTaskId())
            .eq(EvaluationSceneResult::getEvaluateeId, req.getEvaluateeId())
            .eq(EvaluationSceneResult::getMethodKey, req.getMethodKey()).build());
        return toSceneResultDto(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SceneEvaluationResultDto gradeResult(String id, GradeResultRequest req) {
        systemGuard.requireUser();
        if (isStudent()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        EvaluationSceneResult res = sceneResultMapper.selectOne(QueryBuilder.lambda(EvaluationSceneResult.class)
            .eq(EvaluationSceneResult::getId, id).build());
        if (res == null || res.getTenantId() == null) {
            throw new ApiException(404, "not_found", "评价结果不存在");
        }
        String tenantId = systemGuard.requireTenant();
        if (!res.getTenantId().equals(tenantId)) {
            throw new ApiException(404, "not_found", "评价结果不存在");
        }
        int rows = sceneResultMapper.grade(id, tenantId, systemGuard.requireUser(), req.getScore(),
            emptyToNull(req.getComment()),
            toJson(req.getEvalPointScores() == null ? Map.of() : req.getEvalPointScores()),
            toJson(req.getDrawnQuestions() == null ? Map.of() : req.getDrawnQuestions()),
            toJson(req.getSubjectiveContent() == null ? Map.of() : req.getSubjectiveContent()));
        if (rows == 0) {
            throw new ApiException(409, "conflict", "评价结果已评分或不存在，请刷新后重试");
        }
        // 反向回写考试结果分数（同一事务）
        syncExamResultScore(id, res.getTaskId(), res.getMethodKey(), res.getEvaluateeId(), req.getScore());
        return toSceneResultDto(sceneResultMapper.selectOne(QueryBuilder.lambda(EvaluationSceneResult.class)
            .eq(EvaluationSceneResult::getId, id).build()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int batchGradeResults(BatchGradeRequest req) {
        systemGuard.requireUser();
        if (isStudent()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        if (req.getItems() == null || req.getItems().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少评分项");
        }
        if (req.getItems().size() > 200) {
            throw new ApiException(400, "bad_request", "单次最多评分 200 项");
        }
        String tenantId = systemGuard.requireTenant();
        // 批量查一次（替代逐条查询的 N+1），租户限定
        List<String> ids = req.getItems().stream().map(BatchGradeItem::getId).toList();
        List<EvaluationSceneResult> existing = sceneResultMapper.selectList(QueryBuilder.lambda(EvaluationSceneResult.class)
            .eq(EvaluationSceneResult::getTenantId, tenantId).in(EvaluationSceneResult::getId, ids).build());
        Map<String, EvaluationSceneResult> byId = existing.stream()
            .collect(Collectors.toMap(EvaluationSceneResult::getId, r -> r));
        for (BatchGradeItem item : req.getItems()) {
            EvaluationSceneResult res = byId.get(item.getId());
            if (res == null) {
                throw new ApiException(404, "not_found", "评价结果不存在");
            }
            int rows = sceneResultMapper.grade(item.getId(), tenantId, systemGuard.requireUser(), item.getScore(),
                emptyToNull(item.getComment()),
                toJson(item.getEvalPointScores() == null ? Map.of() : item.getEvalPointScores()),
                "{}", "{}");
            if (rows == 0) {
                throw new ApiException(409, "conflict", "存在已评分或不存在的结果，请刷新后重试");
            }
            syncExamResultScore(item.getId(), res.getTaskId(), res.getMethodKey(), res.getEvaluateeId(), item.getScore());
        }
        return req.getItems().size();
    }

    /**
     * 反向回写链（对齐 Go syncExamResultScoreTx）：仅考试类方式回写；优先按成绩行盖章版本
     * 快照的 resource_config（usageId/paperId/examId）定位，缺档回退 live JOIN。
     */
    private void syncExamResultScore(String sceneResultId, String taskId, String methodKey, String evaluateeId,
                                     BigDecimal score) {
        if (!"paper".equals(methodKey) && !"question_bank".equals(methodKey) && !"quiz".equals(methodKey)) {
            return;
        }
        String examResultId = findExamResultForGrading(sceneResultId, taskId, methodKey, evaluateeId);
        if (examResultId == null || examResultId.isEmpty()) {
            return;
        }
        sceneResultMapper.updateExamResultScore(examResultId, score);
    }

    private String findExamResultForGrading(String sceneResultId, String taskId, String methodKey, String evaluateeId) {
        EvaluationSceneResult res = sceneResultMapper.selectOne(QueryBuilder.lambda(EvaluationSceneResult.class)
            .eq(EvaluationSceneResult::getId, sceneResultId).build());
        if (res == null || res.getSceneId() == null || res.getVersion() == null || res.getVersion().isEmpty()
            || res.getTenantId() == null) {
            return findLatestExamResult(taskId, methodKey, evaluateeId);
        }
        String snapshot = sceneResultMapper.scenarioSnapshotData(res.getTenantId(), res.getSceneId(), res.getVersion());
        if (snapshot == null) {
            return findLatestExamResult(taskId, methodKey, evaluateeId);
        }
        // 解析快照内 task_evaluation_methods 的 resource_config
        Map<String, Object> doc = parseJsonMap(snapshot);
        Object methodsRaw = doc.get("task_evaluation_methods");
        if (!(methodsRaw instanceof List<?> methods)) {
            return findLatestExamResult(taskId, methodKey, evaluateeId);
        }
        String usageId = null;
        String examId = null;
        for (Object m : methods) {
            if (!(m instanceof Map<?, ?> mm)) {
                continue;
            }
            if (!taskId.equals(str(mm.get("task_id"))) || !methodKey.equals(str(mm.get("method_key")))) {
                continue;
            }
            Object cfgRaw = mm.get("resource_config");
            if (cfgRaw instanceof Map<?, ?> cfg) {
                usageId = str(cfg.get("usageId"));
                examId = str(cfg.get("paperId"));
                if (examId == null || examId.isEmpty()) {
                    examId = str(cfg.get("examId"));
                }
            }
            break;
        }
        if (usageId != null && !usageId.isEmpty()) {
            return sceneResultMapper.findExamResultByUsage(usageId, evaluateeId);
        }
        if (examId != null && !examId.isEmpty()) {
            return sceneResultMapper.findExamResultByExam(taskId, examId, evaluateeId);
        }
        return null;
    }

    /** live JOIN 回退定位考试结果 */
    private String findLatestExamResult(String taskId, String methodKey, String evaluateeId) {
        return sceneResultMapper.findLatestExamResult(taskId, methodKey, evaluateeId);
    }

    // ==================== 快照 ====================

    /** 试卷快照 bundle 读取（GetBundle 语义） */
    private Map<String, Object> getExamBundle(String tenantId, String examId, String version) {
        String v = version;
        if (v == null || v.isEmpty()) {
            v = snapshotMapper.latestVersion(tenantId, "exams", examId);
        }
        if (v != null && !v.isEmpty()) {
            EvaluationResourceSnapshot snap = snapshotMapper.selectOne(QueryBuilder.lambda(EvaluationResourceSnapshot.class)
                .eq(EvaluationResourceSnapshot::getTenantId, tenantId)
                .eq(EvaluationResourceSnapshot::getResourceType, "exams")
                .eq(EvaluationResourceSnapshot::getResourceId, examId)
                .eq(EvaluationResourceSnapshot::getVersion, v).build());
            if (snap != null && snap.getSnapshotData() != null) {
                return parseJsonMap(snap.getSnapshotData());
            }
        }
        PortalExam live = examMapper.selectOne(QueryBuilder.lambda(PortalExam.class)
            .eq(PortalExam::getId, examId).eq(PortalExam::getTenantId, tenantId).build());
        if (live == null || !"published".equals(live.getStatus())) {
            return null;
        }
        String liveVersion = live.getVersion() == null ? "" : live.getVersion();
        if (version != null && !version.isEmpty() && !version.equals(liveVersion)) {
            return null;
        }
        return buildExamLiveBundle(live);
    }

    /** live 现场组装试卷 bundle（{exam, exam_questions}，schema 与快照 jsonb 一致） */
    private Map<String, Object> buildExamLiveBundle(PortalExam exam) {
        Map<String, Object> bundle = new LinkedHashMap<>();
        Map<String, Object> examObj = new LinkedHashMap<>();
        examObj.put("id", exam.getId());
        examObj.put("code", exam.getCode());
        examObj.put("name", exam.getName());
        examObj.put("description", exam.getDescription());
        examObj.put("status", exam.getStatus());
        examObj.put("total_score", exam.getTotalScore());
        examObj.put("duration", exam.getDuration());
        examObj.put("cover_image", exam.getCoverImage());
        examObj.put("is_temp", exam.getIsTemp());
        examObj.put("collaborator_ids", exam.getCollaboratorIds());
        examObj.put("collaborator_dept_ids", exam.getCollaboratorDeptIds());
        examObj.put("batch_id", exam.getBatchId());
        examObj.put("version", exam.getVersion());
        examObj.put("owner_type", exam.getOwnerType());
        bundle.put("exam", examObj);
        List<EvaluationExamQuestion> qs = examQuestionMapper.selectList(QueryBuilder.lambda(EvaluationExamQuestion.class)
            .eq(EvaluationExamQuestion::getExamId, exam.getId())
            .orderByAsc(EvaluationExamQuestion::getSortOrder).build());
        List<Map<String, Object>> qList = new ArrayList<>();
        for (EvaluationExamQuestion q : qs) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("exam_id", q.getExamId());
            m.put("question_id", q.getQuestionId());
            m.put("type", q.getType());
            m.put("content", q.getContent());
            m.put("options", parseStringList(q.getOptions()));
            m.put("answer", parseAnswer(q.getAnswer()));
            m.put("analysis", q.getAnalysis());
            m.put("score", q.getScore());
            m.put("sort_order", q.getSortOrder());
            qList.add(m);
        }
        bundle.put("exam_questions", qList);
        return bundle;
    }

    /** 发布事务内保存试卷快照 */
    private void saveExamSnapshot(String tenantId, String examId, String version) {
        PortalExam exam = examMapper.selectOne(QueryBuilder.lambda(PortalExam.class)
            .eq(PortalExam::getId, examId).eq(PortalExam::getTenantId, tenantId).build());
        EvaluationResourceSnapshot snap = new EvaluationResourceSnapshot();
        snap.setTenantId(tenantId);
        snap.setResourceType("exams");
        snap.setResourceId(examId);
        snap.setVersion(version);
        snap.setSnapshotData(toJson(buildExamLiveBundle(exam)));
        snapshotMapper.insert(snap);
    }

    /** 场景快照 ExpectedOrLatestVersion（expected 存在则采纳，否则回退最新） */
    private String expectedOrLatestVersion(String tenantId, String sceneId, String expected) {
        if (expected != null && !expected.isEmpty()) {
            EvaluationResourceSnapshot snap = snapshotMapper.selectOne(QueryBuilder.lambda(EvaluationResourceSnapshot.class)
                .eq(EvaluationResourceSnapshot::getTenantId, tenantId)
                .eq(EvaluationResourceSnapshot::getResourceType, "scenarios")
                .eq(EvaluationResourceSnapshot::getResourceId, sceneId)
                .eq(EvaluationResourceSnapshot::getVersion, expected).build());
            if (snap != null) {
                return expected;
            }
        }
        String latest = snapshotMapper.latestVersion(tenantId, "scenarios", sceneId);
        if (latest != null && !latest.isEmpty()) {
            return latest;
        }
        Map<String, Object> live = snapshotMapper.liveVersion(tenantId, "scenarios", sceneId);
        return live == null ? "" : str(live.get("version"));
    }

    /** 考试安排创建/发布时固化的试卷版本（快照最新版本，缺档回退 live version） */
    private String resolveExamVersion(String tenantId, String examId) {
        String latest = snapshotMapper.latestVersion(tenantId, "exams", examId);
        if (latest != null && !latest.isEmpty()) {
            return latest;
        }
        return examUsageMapper.examVersion(examId, tenantId);
    }

    // ==================== 判分 ====================

    static class GradingQuestion {
        String id;
        String type;
        List<String> answer;
        List<String> options;
        BigDecimal score;

        GradingQuestion(String id, String type, List<String> answer, List<String> options, BigDecimal score) {
            this.id = id;
            this.type = type;
            this.answer = answer;
            this.options = options;
            this.score = score;
        }
    }

    static class GradingData {
        List<GradingQuestion> questions;
        BigDecimal totalScore;

        GradingData(List<GradingQuestion> questions, BigDecimal totalScore) {
            this.questions = questions;
            this.totalScore = totalScore;
        }
    }

    /** 判分数据（对齐 Go FetchExamGradingData：快照优先，缺档回退 live） */
    private GradingData fetchExamGradingData(String tenantId, String examId, String examVersion) {
        if (tenantId != null && !tenantId.isEmpty() && examVersion != null && !examVersion.isEmpty()) {
            EvaluationResourceSnapshot snap = snapshotMapper.selectOne(QueryBuilder.lambda(EvaluationResourceSnapshot.class)
                .eq(EvaluationResourceSnapshot::getTenantId, tenantId)
                .eq(EvaluationResourceSnapshot::getResourceType, "exams")
                .eq(EvaluationResourceSnapshot::getResourceId, examId)
                .eq(EvaluationResourceSnapshot::getVersion, examVersion).build());
            if (snap != null && snap.getSnapshotData() != null) {
                return parseExamSnapshotGradingData(snap.getSnapshotData());
            }
        }
        List<GradingQuestion> questions = new ArrayList<>();
        List<Map<String, Object>> rows = examResultMapper.fetchExamQuestions(examId);
        for (Map<String, Object> row : rows) {
            questions.add(new GradingQuestion(str(row.get("id")), str(row.get("type")),
                parseAnswer(str(row.get("answer"))), parseStringList(str(row.get("options"))),
                decOrNull(row.get("score"))));
        }
        BigDecimal total = examResultMapper.liveExamTotalScore(examId);
        return new GradingData(questions, total);
    }

    private GradingData parseExamSnapshotGradingData(String snapshot) {
        Map<String, Object> doc = parseJsonMap(snapshot);
        Object examRaw = doc.get("exam");
        BigDecimal total = BigDecimal.ZERO;
        if (examRaw instanceof Map<?, ?> exam && exam.get("total_score") instanceof Number n) {
            total = new BigDecimal(n.toString());
        }
        List<GradingQuestion> questions = new ArrayList<>();
        Object qsRaw = doc.get("exam_questions");
        if (qsRaw instanceof List<?> qs) {
            for (Object q : qs) {
                if (!(q instanceof Map<?, ?> m)) {
                    continue;
                }
                String id = str(m.get("id"));
                String type = str(m.get("type"));
                List<String> answer = parseSnapshotAnswer(m.get("answer"));
                List<String> options = parseSnapshotOptions(m.get("options"));
                BigDecimal score = m.get("score") instanceof Number n ? new BigDecimal(n.toString()) : BigDecimal.ZERO;
                questions.add(new GradingQuestion(id, type, answer, options, score));
            }
        }
        if (total.signum() == 0) {
            for (GradingQuestion q : questions) {
                total = total.add(q.score);
            }
        }
        return new GradingData(questions, total);
    }

    /** 快照内题目答案：JSON 字符串字面量（to_jsonb 后）或 JSON 数组 */
    private List<String> parseSnapshotAnswer(Object raw) {
        if (raw instanceof List<?> list) {
            List<String> out = new ArrayList<>();
            for (Object x : list) {
                out.add(String.valueOf(x));
            }
            return out;
        }
        if (raw instanceof String s) {
            try {
                List<String> v = MAPPER.readValue(s, STRING_LIST_REF);
                return v == null ? new ArrayList<>() : v;
            } catch (Exception e) {
                return List.of(s);
            }
        }
        return new ArrayList<>();
    }

    /** 快照内题目选项：JSON 字符串字面量（to_jsonb 后）或 JSON 数组 */
    private List<String> parseSnapshotOptions(Object raw) {
        if (raw instanceof List<?> list) {
            List<String> out = new ArrayList<>();
            for (Object x : list) {
                out.add(String.valueOf(x));
            }
            return out;
        }
        if (raw instanceof String s) {
            try {
                List<String> v = MAPPER.readValue(s, STRING_LIST_REF);
                return v == null ? new ArrayList<>() : v;
            } catch (Exception e) {
                return new ArrayList<>();
            }
        }
        return new ArrayList<>();
    }

    /** 客观题判分（对齐 Go isCorrect：判断归一化双向互认；单选/多选字母选项映射为文字） */
    private boolean isCorrect(String qType, List<String> correct, List<String> options, Object raw) {
        if ("judge".equals(qType)) {
            if (correct == null || correct.isEmpty()) {
                return false;
            }
            Boolean s = normalizeJudge(raw == null ? "" : String.valueOf(raw));
            Boolean c = normalizeJudge(correct.get(0));
            return s != null && c != null && s.equals(c);
        }
        if ("single".equals(qType)) {
            if (correct == null || correct.isEmpty()) {
                return false;
            }
            String s = mapAnswerOption(String.valueOf(raw == null ? "" : raw).trim(), options);
            String c = mapAnswerOption(correct.get(0).trim(), options);
            return s.equalsIgnoreCase(c);
        }
        if ("multiple".equals(qType)) {
            List<String> given = new ArrayList<>();
            if (raw instanceof List<?> list) {
                for (Object x : list) {
                    given.add(String.valueOf(x));
                }
            }
            if (given.size() != correct.size()) {
                return false;
            }
            Map<String, Integer> m = new LinkedHashMap<>();
            for (String c : correct) {
                m.merge(mapAnswerOption(c.trim(), options), 1, Integer::sum);
            }
            for (String g : given) {
                g = mapAnswerOption(g.trim(), options);
                Integer cnt = m.get(g);
                if (cnt == null || cnt == 0) {
                    return false;
                }
                m.put(g, cnt - 1);
            }
            return true;
        }
        return false;
    }

    /** 判断题答案归一：兼容 正确/错误/对/错/T/F/true/false/1/0/是/否；无法识别返回 null */
    private Boolean normalizeJudge(String v) {
        switch (v.trim().toLowerCase()) {
            case "正确", "对", "t", "true", "1", "是":
                return Boolean.TRUE;
            case "错误", "错", "f", "false", "0", "否":
                return Boolean.FALSE;
            default:
                return null;
        }
    }

    /** 单字母选项（A-H）映射为选项文字；非字母或超范围原样返回 */
    private String mapAnswerOption(String v, List<String> options) {
        if (v.length() != 1 || options == null || options.isEmpty()) {
            return v;
        }
        char c = v.charAt(0);
        int idx = (c >= 'A' && c <= 'H') ? (c - 'A') : (c >= 'a' && c <= 'h') ? (c - 'a') : -1;
        if (idx >= 0 && idx < options.size() && options.get(idx) != null && !options.get(idx).isEmpty()) {
            return options.get(idx);
        }
        return v;
    }

    static BigDecimal roundScore(BigDecimal s) {
        return s.setScale(1, RoundingMode.HALF_UP);
    }

    // ==================== 组装 ====================

    private List<ExamDto> assembleExams(List<PortalExam> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> ids = rows.stream().map(PortalExam::getId).toList();
        Map<String, Long> countMap = toIdLongMap(examQuestionMapper.countByExamIds(ids), "exam_id", "cnt");
        Map<String, String> userNameMap = userNameMap(collectUserIds(rows));
        List<ExamDto> items = new ArrayList<>(rows.size());
        for (PortalExam e : rows) {
            ExamDto dto = toExamDto(e);
            dto.setQuestionCount(countMap.getOrDefault(e.getId(), 0L).intValue());
            dto.setCreatorName(e.getCreatorId() == null ? null : userNameMap.get(e.getCreatorId()));
            dto.setCollaboratorNames(mapOrdered(e.getCollaboratorIds(), userNameMap));
            items.add(dto);
        }
        return items;
    }

    private ExamDto assembleExam(PortalExam e) {
        ExamDto dto = toExamDto(e);
        dto.setQuestionCount(examQuestionMapper.selectCount(QueryBuilder.lambda(EvaluationExamQuestion.class)
            .eq(EvaluationExamQuestion::getExamId, e.getId()).build()).intValue());
        List<EvaluationExamQuestion> qs = examQuestionMapper.selectList(QueryBuilder.lambda(EvaluationExamQuestion.class)
            .eq(EvaluationExamQuestion::getExamId, e.getId())
            .orderByAsc(EvaluationExamQuestion::getSortOrder).build());
        List<ExamQuestionDto> questions = new ArrayList<>(qs.size());
        for (EvaluationExamQuestion q : qs) {
            ExamQuestionDto qd = new ExamQuestionDto();
            qd.setId(q.getId());
            qd.setExamId(q.getExamId());
            qd.setQuestionId(q.getQuestionId());
            qd.setType(q.getType());
            qd.setContent(q.getContent());
            qd.setOptions(parseStringList(q.getOptions()));
            qd.setAnswer(parseAnswer(q.getAnswer()));
            qd.setAnalysis(q.getAnalysis());
            qd.setScore(q.getScore());
            qd.setOrder(q.getSortOrder());
            questions.add(qd);
        }
        dto.setQuestions(questions);
        Map<String, String> userNameMap = userNameMap(collectUserIds(List.of(e)));
        dto.setCreatorName(e.getCreatorId() == null ? null : userNameMap.get(e.getCreatorId()));
        dto.setCollaboratorNames(mapOrdered(e.getCollaboratorIds(), userNameMap));
        return dto;
    }

    private ExamDto toExamDto(PortalExam e) {
        ExamDto dto = new ExamDto();
        dto.setId(e.getId());
        dto.setCode(e.getCode());
        dto.setName(e.getName());
        dto.setDescription(e.getDescription());
        dto.setStatus(e.getStatus());
        dto.setTotalScore(e.getTotalScore());
        dto.setDuration(e.getDuration());
        dto.setCoverImage(e.getCoverImage());
        dto.setCollaboratorIds(e.getCollaboratorIds());
        dto.setCollaboratorDeptIds(e.getCollaboratorDeptIds());
        dto.setBatchId(e.getBatchId());
        dto.setVersion(e.getVersion());
        dto.setOwnerType(e.getOwnerType());
        dto.setCreatorId(e.getCreatorId());
        dto.setCreatedAt(e.getCreatedAt());
        dto.setUpdatedAt(e.getUpdatedAt());
        dto.setIsTemp(e.getIsTemp());
        return dto;
    }

    private ExamUsageDto toExamUsageDto(EvaluationExamUsage u) {
        ExamUsageDto dto = new ExamUsageDto();
        dto.setId(u.getId());
        dto.setExamId(u.getExamId());
        dto.setName(u.getName());
        dto.setDescription(u.getDescription());
        dto.setStartTime(u.getStartTime());
        dto.setEndTime(u.getEndTime());
        dto.setDuration(u.getDuration());
        dto.setTargetType(u.getTargetType());
        dto.setTargetIds(u.getTargetIds());
        dto.setStatus(u.getStatus());
        dto.setActivationMode(u.getActivationMode());
        dto.setExamVersion(u.getExamVersion());
        dto.setCreatorId(u.getCreatorId());
        dto.setCreatedAt(u.getCreatedAt());
        dto.setUpdatedAt(u.getUpdatedAt());
        return dto;
    }

    private List<ExamResultDto> assembleExamResults(List<EvaluationExamResult> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> majorIds = new LinkedHashSet<>();
        for (EvaluationExamResult r : rows) {
            if (r.getMajorId() != null) {
                majorIds.add(r.getMajorId());
            }
        }
        Map<String, String> majorNames = majorIds.isEmpty() ? Map.of() : toIdStringMap(
            examResultMapper.selectMajorNames(new ArrayList<>(majorIds)), "id", "name");
        List<ExamResultDto> items = new ArrayList<>(rows.size());
        for (EvaluationExamResult r : rows) {
            ExamResultDto dto = toExamResultDto(r);
            dto.setMajorName(r.getMajorId() == null ? null : majorNames.get(r.getMajorId()));
            items.add(dto);
        }
        return items;
    }

    private ExamResultDto toExamResultDto(EvaluationExamResult r) {
        if (r == null) {
            return null;
        }
        ExamResultDto dto = new ExamResultDto();
        dto.setId(r.getId());
        dto.setExamUsageId(r.getExamUsageId());
        dto.setUserId(r.getUserId());
        dto.setStudentName(r.getStudentName());
        dto.setClassName(r.getClassName());
        dto.setGrade(r.getGrade());
        dto.setMajorId(r.getMajorId());
        dto.setScore(r.getScore());
        dto.setTotalScore(r.getTotalScore());
        dto.setIsPass(r.getIsPass());
        dto.setAnswers(parseJsonMap(r.getAnswers()));
        dto.setGradingStatus(r.getGradingStatus());
        dto.setGradingScores(parseJsonMap(r.getGradingScores()));
        dto.setGradingComment(r.getGradingComment());
        dto.setGraderId(r.getGraderId());
        dto.setGradedAt(r.getGradedAt());
        dto.setSubmitTime(r.getSubmitTime());
        dto.setCreatedAt(r.getCreatedAt());
        dto.setVersion(r.getVersion());
        return dto;
    }

    private SceneEvaluationResultDto toSceneResultDto(EvaluationSceneResult r) {
        SceneEvaluationResultDto dto = new SceneEvaluationResultDto();
        dto.setId(r.getId());
        dto.setTaskId(r.getTaskId());
        dto.setSceneId(r.getSceneId());
        dto.setMethodKey(r.getMethodKey());
        dto.setEvaluateeId(r.getEvaluateeId());
        dto.setEvaluatorId(r.getEvaluatorId());
        dto.setEvaluatorType(r.getEvaluatorType());
        dto.setStatus(r.getStatus());
        dto.setTotalScore(r.getTotalScore());
        dto.setMaxScore(r.getMaxScore());
        dto.setEvalPointScores(parseJsonMap(r.getEvalPointScores()));
        dto.setObjectiveAnswers(parseJsonMap(r.getObjectiveAnswers()));
        dto.setSubjectiveContent(parseJsonMap(r.getSubjectiveContent()));
        dto.setDrawnQuestions(parseJsonMap(r.getDrawnQuestions()));
        dto.setComment(r.getComment());
        dto.setGradedAt(r.getGradedAt());
        dto.setGradedBy(r.getGradedBy());
        dto.setVersion(r.getVersion());
        dto.setCreatedAt(r.getCreatedAt());
        dto.setUpdatedAt(r.getUpdatedAt());
        return dto;
    }

    // ==================== 内部 ====================

    private PortalExam fetchExam(String id) {
        String tenantId = systemGuard.requireTenant();
        PortalExam exam = examMapper.selectOne(QueryBuilder.lambda(PortalExam.class)
            .eq(PortalExam::getId, id).eq(PortalExam::getTenantId, tenantId).build());
        if (exam == null) {
            throw new ApiException(404, "not_found", "考试不存在");
        }
        return exam;
    }

    private EvaluationExamUsage fetchExamUsage(String id) {
        String tenantId = systemGuard.requireTenant();
        EvaluationExamUsage usage = examUsageMapper.selectOne(QueryBuilder.lambda(EvaluationExamUsage.class)
            .eq(EvaluationExamUsage::getId, id).eq(EvaluationExamUsage::getTenantId, tenantId).build());
        if (usage == null) {
            throw new ApiException(404, "not_found", "考试安排不存在");
        }
        return usage;
    }

    private boolean userInTenant(String userId, String tenantId) {
        try {
            return userMapper.selectOne(QueryBuilder.lambda(ZhiyuUser.class)
                .eq(ZhiyuUser::getId, userId).eq(ZhiyuUser::getTenantId, tenantId).build()) != null;
        } catch (Exception e) {
            return false;
        }
    }

    private Map<String, String> userNameMap(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return userMapper.selectList(QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, ids).build())
                .stream().filter(u -> u.getName() != null)
                .collect(Collectors.toMap(ZhiyuUser::getId, ZhiyuUser::getName));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private List<String> collectUserIds(List<PortalExam> rows) {
        Set<String> ids = new LinkedHashSet<>();
        for (PortalExam e : rows) {
            if (e.getCreatorId() != null) {
                ids.add(e.getCreatorId());
            }
            if (e.getCollaboratorIds() != null) {
                ids.addAll(e.getCollaboratorIds());
            }
        }
        return new ArrayList<>(ids);
    }

    private Map<String, Long> toIdLongMap(List<Map<String, Object>> rows, String idKey, String valKey) {
        Map<String, Long> map = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object val = row.get(valKey);
            map.put(String.valueOf(row.get(idKey)), val == null ? 0L : ((Number) val).longValue());
        }
        return map;
    }

    private Map<String, String> toIdStringMap(List<Map<String, Object>> rows, String idKey, String valKey) {
        Map<String, String> map = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object v = row.get(valKey);
            map.put(String.valueOf(row.get(idKey)), v == null ? "" : String.valueOf(v));
        }
        return map;
    }

    private List<String> mapOrdered(List<String> ids, Map<String, String> nameMap) {
        if (ids == null) {
            return null;
        }
        List<String> out = new ArrayList<>(ids.size());
        for (String id : ids) {
            out.add(nameMap.getOrDefault(id, ""));
        }
        return out;
    }

    private void stripAnswers(Map<String, Object> bundle, String key, String... fields) {
        Object raw = bundle.get(key);
        if (!(raw instanceof List<?> rows)) {
            return;
        }
        List<Object> cleaned = new ArrayList<>();
        for (Object row : rows) {
            if (row instanceof Map<?, ?> m) {
                Map<String, Object> copy = new LinkedHashMap<>();
                m.forEach((k, v) -> copy.put(String.valueOf(k), v));
                for (String f : fields) {
                    copy.remove(f);
                }
                cleaned.add(copy);
            } else {
                cleaned.add(row);
            }
        }
        bundle.put(key, cleaned);
    }

    private String generateUniqueCode(String tenantId, String prefix,
                                      java.util.function.BiFunction<String, String, Boolean> exists) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder(prefix).append('-');
            for (int j = 0; j < 8; j++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!Boolean.TRUE.equals(exists.apply(tenantId, code))) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成" + prefix + "编码失败");
    }

    static String nextVersion(String v) {
        int major = 1;
        int minor = 0;
        String s = v == null ? "" : v.trim();
        int start = 0;
        int end = s.length();
        while (start < end && (s.charAt(start) == 'v' || s.charAt(start) == 'V')) {
            start++;
        }
        while (end > start && (s.charAt(end - 1) == 'v' || s.charAt(end - 1) == 'V')) {
            end--;
        }
        String digits = s.substring(start, end);
        String[] parts = digits.split("\\.");
        if (parts.length > 0) {
            try {
                major = Integer.parseInt(parts[0].trim());
            } catch (NumberFormatException ignored) {
            }
        }
        if (parts.length > 1) {
            try {
                minor = Integer.parseInt(parts[1].trim());
            } catch (NumberFormatException ignored) {
            }
        }
        minor++;
        if (minor >= 10) {
            major++;
            minor = 0;
        }
        return "V" + major + "." + minor;
    }

    List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = MAPPER.readValue(json, STRING_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    List<String> parseAnswer(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = MAPPER.readValue(json, STRING_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return List.of(json);
        }
    }

    Map<String, Object> parseJsonMap(String json) {
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

    String toJson(Object v) {
        try {
            return MAPPER.writeValueAsString(v);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String toLikePattern(String s) {
        if (s == null || s.isEmpty()) {
            return "";
        }
        return "%" + s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
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

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private Integer intOrNull(Object o) {
        return o == null ? null : ((Number) o).intValue();
    }

    private BigDecimal decOrNull(Object o) {
        return o == null ? null : new BigDecimal(o.toString());
    }

    private OffsetDateTime odt(Object o) {
        return o instanceof OffsetDateTime odt ? odt : null;
    }

    private boolean boolOrFalse(Object o) {
        return o != null && Boolean.parseBoolean(String.valueOf(o));
    }
}
