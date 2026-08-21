package org.dromara.zhiyu.service.impl.scene;

import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.util.ZhiyuJsonUtils;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.EvalMethodListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.EvalPointInput;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.RubricTemplateDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.RubricTemplateRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ReviewStepInput;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.SaveEvalMethodsRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ScoreRuleInput;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskEvalPointDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskEvaluationMethodDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskEvaluationMethodInput;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskReviewStepDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskScoreRuleDto;
import org.dromara.zhiyu.domain.scene.SceneEvalMethod;
import org.dromara.zhiyu.domain.scene.SceneEvalPoint;
import org.dromara.zhiyu.domain.scene.SceneReviewStep;
import org.dromara.zhiyu.domain.evaluation.EvaluationQuestion;
import org.dromara.zhiyu.domain.scene.SceneRubricTemplate;
import org.dromara.zhiyu.domain.scene.SceneScoreRule;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamQuestionMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamUsageMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationQuestionMapper;
import org.dromara.zhiyu.mapper.portal.PortalResourceSnapshotMapper;
import org.dromara.zhiyu.mapper.scene.SceneEvalMethodMapper;
import org.dromara.zhiyu.mapper.scene.SceneEvalPointMapper;
import org.dromara.zhiyu.mapper.scene.SceneReviewStepMapper;
import org.dromara.zhiyu.mapper.scene.SceneScoreRuleMapper;
import org.dromara.zhiyu.mapper.scene.SceneRubricTemplateMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioTaskMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.scene.ISceneEvalMethodService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 任务测评方式 + 评分模板服务实现（对齐 Go task_evaluation_handler.go +
 * service/task_evaluation.go + store/task_evaluation.go 语义）。
 *
 * <p>关键对齐点：</p>
 * <ul>
 *   <li>ListMethods 返回任务全部方法（启用+禁用），评估点/评分规则/评审步骤按 config_id 批量组装；</li>
 *   <li>SaveMethods 乐观锁（advisory 锁 + MAX(version) 严格大于判定）+ 方法行 upsert +
 *       子表先删后插（仅重写 payload 内方法，不触碰 payload 之外的方法）；</li>
 *   <li>临时考试联动（对齐 Go EnsureExamUsageForMethod）：paper/question_bank/quiz 启用时
 *       在事务内、持锁后维护临时考试与 exam_usages（自动命名「场景名-任务名-测评类型-YYYYMMDD-序号」），
 *       examId/usageId 写回 resourceConfig；败者事务回滚时联动写入一并回滚；</li>
 *   <li>评价标准为纯复制语义：rubric_template_id 恒不写入。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class SceneEvalMethodServiceImpl implements ISceneEvalMethodService {

    private static final TypeReference<List<Object>> LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    /** 试卷编码字符集（对齐 Go entityCodeAlphabet） */
    private static final String CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private final SystemGuard systemGuard;
    private final SceneEvalMethodMapper evalMethodMapper;
    private final SceneEvalPointMapper evalPointMapper;
    private final SceneScoreRuleMapper scoreRuleMapper;
    private final SceneReviewStepMapper reviewStepMapper;
    private final SceneRubricTemplateMapper templateMapper;
    private final SceneScenarioTaskMapper taskMapper;
    private final EvaluationExamMapper examMapper;
    private final EvaluationExamUsageMapper examUsageMapper;
    private final EvaluationExamQuestionMapper examQuestionMapper;
    private final EvaluationQuestionMapper questionMapper;
    private final PortalResourceSnapshotMapper snapshotMapper;

    // ---------- 测评方式 ----------

    @Override
    public EvalMethodListResponse listMethods(String taskId) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        List<SceneEvalMethod> methods = evalMethodMapper.selectList(
            QueryBuilder.lambda(SceneEvalMethod.class)
                .eq(SceneEvalMethod::getTaskId, taskId)
                .eq(SceneEvalMethod::getTenantId, tenantId)
                .orderByAsc(SceneEvalMethod::getMethodKey)
                .build());
        if (methods.isEmpty()) {
            return new EvalMethodListResponse();
        }
        List<String> configIds = methods.stream().map(SceneEvalMethod::getId).toList();
        Map<String, List<SceneEvalPoint>> pointsByConfig = groupByConfig(evalPointMapper.selectList(
            QueryBuilder.lambda(SceneEvalPoint.class)
                .in(SceneEvalPoint::getConfigId, configIds)
                .orderByAsc(SceneEvalPoint::getSortOrder)
                .build()));
        Map<String, List<SceneScoreRule>> rulesByConfig = groupByConfig(scoreRuleMapper.selectList(
            QueryBuilder.lambda(SceneScoreRule.class)
                .in(SceneScoreRule::getConfigId, configIds)
                .orderByAsc(SceneScoreRule::getSortOrder)
                .build()));
        Map<String, List<SceneReviewStep>> stepsByConfig = groupByConfig(reviewStepMapper.selectList(
            QueryBuilder.lambda(SceneReviewStep.class)
                .in(SceneReviewStep::getConfigId, configIds)
                .orderByAsc(SceneReviewStep::getSortOrder)
                .build()));

        EvalMethodListResponse resp = new EvalMethodListResponse();
        List<TaskEvaluationMethodDto> dtos = new ArrayList<>(methods.size());
        for (SceneEvalMethod m : methods) {
            TaskEvaluationMethodDto dto = new TaskEvaluationMethodDto();
            dto.setId(m.getId());
            dto.setTaskId(m.getTaskId());
            dto.setMethodKey(m.getMethodKey());
            dto.setWeight(m.getWeight());
            dto.setEvalObject(m.getEvalObject());
            dto.setScoreType(m.getScoreType());
            dto.setEvalSubjects(parseList(m.getEvalSubjects()));
            dto.setRubricTemplateId(m.getRubricTemplateId());
            dto.setStandardName(m.getStandardName());
            dto.setStandardMode(m.getStandardMode());
            dto.setResourceConfig(parseMap(m.getResourceConfig()));
            dto.setVersion(m.getVersion());
            dto.setIsEnabled(m.getIsEnabled());
            dto.setEvalPoints(toEvalPointDtos(pointsByConfig.getOrDefault(m.getId(), List.of())));
            dto.setScoreRules(toScoreRuleDtos(rulesByConfig.getOrDefault(m.getId(), List.of())));
            dto.setReviewSteps(toReviewStepDtos(stepsByConfig.getOrDefault(m.getId(), List.of())));
            dtos.add(dto);
        }
        resp.setMethods(dtos);
        return resp;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public EvalMethodListResponse saveMethods(String taskId, SaveEvalMethodsRequest req) {
        String tenantId = systemGuard.requireTenant();
        String creatorId = systemGuard.requireUser();

        // 任务归属校验（task→tenant；对齐 Go TaskTenantID 判定）
        String taskTenantId = taskMapper.selectTenantId(taskId);
        if (taskTenantId == null || !taskTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "场景任务不存在");
        }

        String taskName = "未命名任务";
        try {
            String name = taskMapper.selectName(taskId);
            if (name != null && !name.isEmpty()) {
                taskName = name;
            }
        } catch (Exception ignored) {
            // 默认名
        }
        int version = req.getVersion() == null ? 0 : req.getVersion();
        int newVersion = version + 1;

        // advisory 锁串行化并发保存（事务内，提交/回滚自动释放）
        evalMethodMapper.lockTaskEval(tenantId + "|" + taskId);
        Integer currentVersion = evalMethodMapper.selectMaxVersion(taskId, tenantId);
        if (currentVersion != null && currentVersion > version) {
            throw new ApiException(409, "conflict", "评价规则已被其他会话修改");
        }
        // 临时考试联动（对齐 Go EnsureExamUsageForMethod）：在事务内、持锁后执行，
        // 败者事务回滚时其 exam_usages 写入一并回滚；examId/usageId 写回 resourceConfig 后再落方法行
        for (TaskEvaluationMethodInput input : req.getMethods() == null ? List.<TaskEvaluationMethodInput>of() : req.getMethods()) {
            if (!Boolean.TRUE.equals(input.getIsEnabled())) {
                continue;
            }
            String methodKey = input.getMethodKey();
            if (!"paper".equals(methodKey) && !"question_bank".equals(methodKey) && !"quiz".equals(methodKey)) {
                continue;
            }
            Map<String, Object> resourceConfig = asMap(input.getResourceConfig());
            ensureExamUsageForMethod(tenantId, taskId, taskName, creatorId, methodKey, resourceConfig);
            input.setResourceConfig(resourceConfig);
        }

        for (TaskEvaluationMethodInput input : req.getMethods() == null ? List.<TaskEvaluationMethodInput>of() : req.getMethods()) {
            boolean enabled = Boolean.TRUE.equals(input.getIsEnabled());
            evalMethodMapper.upsertMethod(tenantId, taskId,
                input.getMethodKey(), input.getWeight() == null ? BigDecimal.ZERO : input.getWeight(),
                input.getEvalObject(), input.getScoreType(),
                ZhiyuJsonUtils.toJson(input.getEvalSubjects(), "[]"),
                input.getStandardName(), input.getStandardMode(),
                ZhiyuJsonUtils.toJson(input.getResourceConfig(), "{}"),
                newVersion, enabled);
            // upsert 后回读唯一键（task_id + method_key）对应行 id
            String configId = evalMethodMapper.selectMethodId(tenantId, taskId, input.getMethodKey());
            if (!enabled) {
                // 禁用：清空子表后不插子数据
                evalMethodMapper.deleteEvalPointsByConfig(configId);
                evalMethodMapper.deleteScoreRulesByConfig(configId);
                evalMethodMapper.deleteReviewStepsByConfig(configId);
                continue;
            }
            // 评估点/评分规则/评审步骤先删后插
            evalMethodMapper.deleteEvalPointsByConfig(configId);
            for (EvalPointInput ep : input.getEvalPoints() == null ? List.<EvalPointInput>of() : input.getEvalPoints()) {
                evalMethodMapper.insertEvalPoint(tenantId, configId, ep.getName(), ep.getDescription(), ep.getSubType(),
                    coalesce(ep.getTypes()), ep.getWeight() == null ? BigDecimal.ZERO : ep.getWeight(),
                    ep.getScoringMethod(), ZhiyuJsonUtils.toJson(ep.getGradeMapping(), "[]"),
                    coalesce(ep.getKnowledgePointIds()), coalesce(ep.getAbilityPointIds()),
                    ep.getSortOrder() == null ? 0 : ep.getSortOrder());
            }
            evalMethodMapper.deleteScoreRulesByConfig(configId);
            for (ScoreRuleInput sr : input.getScoreRules() == null ? List.<ScoreRuleInput>of() : input.getScoreRules()) {
                evalMethodMapper.insertScoreRule(tenantId, configId, sr.getName(), sr.getDescription(), sr.getRule(),
                    sr.getWeight() == null ? BigDecimal.ZERO : sr.getWeight(),
                    sr.getSortOrder() == null ? 0 : sr.getSortOrder());
            }
            evalMethodMapper.deleteReviewStepsByConfig(configId);
            for (ReviewStepInput rs : input.getReviewSteps() == null ? List.<ReviewStepInput>of() : input.getReviewSteps()) {
                // 任务级企业导师分配仅对 enterprise_mentor 步骤持久化（对齐 Go convertReviewSteps）
                List<String> assigned = List.of();
                if ("enterprise_mentor".equals(rs.getSubjectType()) && rs.getAssignedUserIds() != null) {
                    assigned = rs.getAssignedUserIds();
                }
                evalMethodMapper.insertReviewStep(tenantId, configId, rs.getLabel(), rs.getDescription(),
                    !Boolean.FALSE.equals(rs.getEnabled()), rs.getSubjectType(),
                    rs.getWeight() == null ? BigDecimal.ZERO : rs.getWeight(),
                    rs.getSortOrder() == null ? 0 : rs.getSortOrder(), assigned);
            }
        }
        return listMethods(taskId);
    }

    // ---------- 临时考试联动（对齐 Go store/task_evaluation.go EnsureExamUsageForMethod） ----------

    /**
     * 确保试卷/题库/随堂测方法存在临时考试与使用记录（exam_usages）。
     *
     * <p>语义逐条对齐 Go：</p>
     * <ul>
     *   <li>paper 的 examId 优先取 paperId；question_bank/quiz 无 questionIds 时不做任何联动；</li>
     *   <li>question_bank/quiz 无 examId 时按「任务名-测评类型-任务ID」复用/创建临时卷
     *       （published、is_temp=TRUE、SJ- 唯一编码、默认时长 90 分钟），随后同步题目并重算总分
     *       （questionScores 覆盖题库原分）；</li>
     *   <li>有 usageId 时仅更新开放时间窗/时长/启用条件（always 模式顺带置 published）；</li>
     *   <li>无 usageId 时先复用同试卷同任务的 draft 安排，否则新建安排并按
     *       「场景名-任务名-测评类型-YYYYMMDD-同天序号」自动命名，创建即固化 exam_version
     *       （快照最新为准，缺档回退 live version）。</li>
     * </ul>
     *
     * <p>与 Go 的已知差异：Go 在题目同步后还有 SyncTempExamSnapshot（temp exam 版本 bump +
     * 快照重写 + 引用安排 exam_version 刷新）；Java 侧 exams 快照构建（BuildExamSnapshot）
     * 尚未移植，此处与 LessonCourseServiceImpl 已有移植保持一致省略。</p>
     */
    private void ensureExamUsageForMethod(String tenantId, String taskId, String taskName, String creatorId,
                                          String methodKey, Map<String, Object> resourceConfig) {
        String label = switch (methodKey) {
            case "paper" -> "试卷";
            case "question_bank" -> "题库";
            case "quiz" -> "随堂测";
            default -> methodKey;
        };

        String examId = strValue(resourceConfig.get("examId"));
        if ("paper".equals(methodKey)) {
            String paperId = strValue(resourceConfig.get("paperId"));
            if (paperId != null) {
                examId = paperId;
            }
        }
        String usageId = strValue(resourceConfig.get("usageId"));

        if ("question_bank".equals(methodKey) || "quiz".equals(methodKey)) {
            List<String> questionIds = stringList(resourceConfig.get("questionIds"));
            if (questionIds.isEmpty()) {
                return;
            }
            if (examId == null) {
                int examDuration = intValue(resourceConfig.get("duration"), 0);
                if (examDuration <= 0) {
                    examDuration = intValue(resourceConfig.get("timeLimit"), 0);
                }
                if (examDuration <= 0) {
                    examDuration = 90;
                }
                examId = createTempExam(tenantId, taskName + "-" + label + "-" + taskId, examDuration, creatorId);
                resourceConfig.put("examId", examId);
            }
            syncExamQuestions(tenantId, examId, questionIds, floatMap(resourceConfig.get("questionScores")));
        }

        if (examId == null) {
            return;
        }
        String startTime = extractScheduledTime(resourceConfig, "scheduledTime");
        String endTime = extractScheduledTime(resourceConfig, "scheduledEndTime");
        Integer duration = extractUsageDuration(resourceConfig, methodKey);
        String activationMode = resolveActivationMode(resourceConfig, methodKey);
        if (usageId == null) {
            // 名称前缀：场景名-任务名（示例：软件项目经理场景2-任务 1）
            String scenarioName = strValue(taskMapper.selectScenarioName(taskId));
            String taskDisplayName = strValue(taskMapper.selectName(taskId));
            usageId = createTempExamUsage(tenantId, examId, taskId, creatorId, startTime, endTime, duration,
                activationMode, label, usageNamePrefix(scenarioName, taskDisplayName));
            resourceConfig.put("usageId", usageId);
        } else {
            examUsageMapper.updateUsageWindow(usageId, tenantId, startTime, endTime, duration, activationMode);
        }
    }

    /** 创建任务临时考试安排（先复用 draft 安排，否则新建并自动命名；对齐 Go createTempExamUsage）。 */
    private String createTempExamUsage(String tenantId, String examId, String taskId, String creatorId,
                                       String startTime, String endTime, Integer duration,
                                       String activationMode, String label, String prefix) {
        String existingId = examUsageMapper.selectDraftTaskUsageId(tenantId, examId, taskId);
        if (existingId != null && !existingId.isEmpty()) {
            examUsageMapper.updateUsageWindow(existingId, tenantId, startTime, endTime, duration, activationMode);
            return existingId;
        }
        String id = UUID.randomUUID().toString();
        // 初始状态：随时作答 → 已发布；定时/手动启停 → 草稿（开启后发布）
        String status = "always".equals(activationMode) ? ZhiyuStatusConstants.PUBLISHED : ZhiyuStatusConstants.DRAFT;
        // 名称：{场景名-任务名}-{测评类型}-{YYYYMMDD}-{序号}（同一天多个测评序号递增）
        String name = nextAutoUsageName(tenantId, "task", prefix, label);
        // 绑定固化（文档 5.3）：创建即打 exam_version（快照最新为准，缺档回退 live version）
        String examVersion = resolveExamVersion(tenantId, examId);
        examUsageMapper.insertNodeUsage(id, tenantId, examId, name, startTime, endTime, duration,
            "task", List.of(taskId), status, activationMode,
            creatorId == null || creatorId.isEmpty() ? null : creatorId,
            examVersion == null || examVersion.isEmpty() ? null : examVersion);
        return id;
    }

    /** 自动考试安排名称：{前缀}-{测评类型}-{YYYYMMDD}-{同天序号}（对齐 Go NextAutoUsageName）。 */
    private String nextAutoUsageName(String tenantId, String targetType, String prefix, String label) {
        String date = examUsageMapper.currentDateYmd();
        int count = examUsageMapper.countUsagesCreatedToday(tenantId, targetType);
        return prefix + "-" + label + "-" + date + "-" + (count + 1);
    }

    /** 名称前缀：场景名-任务名；两端皆空时回退「场景任务」（对齐 Go prefix 拼装与 TrimSpace）。 */
    private String usageNamePrefix(String scenarioName, String taskName) {
        String prefix = ((scenarioName == null ? "" : scenarioName) + "-"
            + (taskName == null ? "" : taskName)).trim();
        if (prefix.isEmpty() || "-".equals(prefix)) {
            prefix = "场景任务";
        }
        return prefix;
    }

    /** 复用/创建临时卷（按租户+名称+is_temp 去重；published；对齐 Go createTempExam）。 */
    private String createTempExam(String tenantId, String name, int duration, String creatorId) {
        String existing = examMapper.selectTempExamId(tenantId, name);
        if (existing != null && !existing.isEmpty()) {
            return existing;
        }
        String id = UUID.randomUUID().toString();
        examMapper.insertTempExam(id, tenantId, generateExamCode(tenantId), name, duration, creatorId);
        return id;
    }

    /** 生成唯一试卷编码（SJ- + 8 位，冲突重试；对齐 Go GenerateUniqueEntityCode）。 */
    private String generateExamCode(String tenantId) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder("SJ-");
            for (int j = 0; j < 8; j++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!examMapper.existsCode(tenantId, code)) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成试卷编码失败");
    }

    /** 同步考试题目并重算总分（prune 旧题 + 按配置顺序 upsert；对齐 Go SyncExamQuestions）。 */
    private void syncExamQuestions(String tenantId, String examId, List<String> questionIds,
                                   Map<String, Double> questionScores) {
        examQuestionMapper.deleteNotIn(examId, tenantId, questionIds);
        List<EvaluationQuestion> questions = questionMapper.selectByIdsOrdered(questionIds, tenantId);
        int sortOrder = 0;
        for (EvaluationQuestion q : questions) {
            BigDecimal score = q.getScore();
            Double overrideScore = questionScores == null ? null : questionScores.get(q.getId());
            if (overrideScore != null && overrideScore > 0) {
                score = BigDecimal.valueOf(overrideScore);
            }
            examQuestionMapper.upsertExamQuestion(UUID.randomUUID().toString(), tenantId, examId, q.getId(),
                q.getType(), q.getContent(), q.getOptions(), q.getAnswer(), q.getAnalysis(), score, ++sortOrder);
        }
        examQuestionMapper.recalcExamTotal(examId, tenantId);
    }

    /** 解析试卷版本（快照最新为准，缺档回退 live version；对齐 Go ResolveResourceVersion）。 */
    private String resolveExamVersion(String tenantId, String examId) {
        String v = snapshotMapper.selectLatestVersion(tenantId, "exams", examId);
        if (v != null && !v.isEmpty()) {
            return v;
        }
        String live = examMapper.selectVersion(tenantId, examId);
        return live == null ? "" : live;
    }

    /** 解析测评方式启用条件：随时作答/定时启停/手动启停（对齐 Go ResolveActivationMode）。 */
    private String resolveActivationMode(Map<String, Object> resourceConfig, String methodKey) {
        String mode = strValue(resourceConfig.get("activationMode"));
        if (mode != null) {
            return mode;
        }
        if ("question_bank".equals(methodKey) || "quiz".equals(methodKey)) {
            return "always";
        }
        return "manual";
    }

    /** 开放时间窗：仅「定时启用」配置生效，其余模式不设窗口（对齐 Go ExtractExamUsageWindow）。 */
    private String extractScheduledTime(Map<String, Object> resourceConfig, String key) {
        if (!"scheduled".equals(strValue(resourceConfig.get("activationMode")))) {
            return null;
        }
        return strValue(resourceConfig.get(key));
    }

    /** 考试安排时长（分钟）：题库/随堂测取 timeLimit，试卷取 duration，未配置返回 null（对齐 Go ExtractExamUsageDuration）。 */
    private Integer extractUsageDuration(Map<String, Object> resourceConfig, String methodKey) {
        int d;
        if ("paper".equals(methodKey)) {
            d = intValue(resourceConfig.get("duration"), 0);
        } else {
            d = intValue(resourceConfig.get("timeLimit"), 0);
            if (d <= 0) {
                d = intValue(resourceConfig.get("duration"), 0);
            }
        }
        return d > 0 ? d : null;
    }

    private Map<String, Object> asMap(Object raw) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (raw instanceof Map<?, ?> m) {
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (e.getKey() != null) {
                    out.put(String.valueOf(e.getKey()), e.getValue());
                }
            }
        }
        return out;
    }

    private List<String> stringList(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (Object x : list) {
            if (x instanceof String s) {
                out.add(s);
            }
        }
        return out;
    }

    private Map<String, Double> floatMap(Object raw) {
        if (!(raw instanceof Map<?, ?> m)) {
            return null;
        }
        Map<String, Double> out = new LinkedHashMap<>();
        for (Map.Entry<?, ?> e : m.entrySet()) {
            if (e.getKey() != null && e.getValue() instanceof Number n) {
                out.put(String.valueOf(e.getKey()), n.doubleValue());
            }
        }
        return out;
    }

    private String strValue(Object raw) {
        if (raw == null) {
            return null;
        }
        String s = String.valueOf(raw);
        return s.isEmpty() ? null : s;
    }

    private int intValue(Object raw, int def) {
        if (raw instanceof Number n) {
            return n.intValue();
        }
        if (raw != null) {
            try {
                return Integer.parseInt(String.valueOf(raw).trim());
            } catch (NumberFormatException ignored) {
                // 非数字按默认值
            }
        }
        return def;
    }

    // ---------- 评分模板 ----------

    @Override
    public ListResponse<RubricTemplateDto> listTemplates(String keyword, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        LambdaQueryBuilder<SceneRubricTemplate> wrapper = QueryBuilder.lambda(SceneRubricTemplate.class)
            .eq(SceneRubricTemplate::getTenantId, tenantId)
            .eq(SceneRubricTemplate::getIsDeleted, false);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(SceneRubricTemplate::getName, keyword);
        }
        long total = templateMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SceneRubricTemplate::getUpdatedAt).last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<SceneRubricTemplate> rows = templateMapper.selectList(wrapper.build());
        List<RubricTemplateDto> items = new ArrayList<>(rows.size());
        for (SceneRubricTemplate t : rows) {
            items.add(toTemplateDto(t));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public RubricTemplateDto getTemplate(String id) {
        systemGuard.requireTenant();
        SceneRubricTemplate t = fetchOwnedTemplate(id);
        return toTemplateDto(t);
    }

    @Override
    public RubricTemplateDto createTemplate(RubricTemplateRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        validateTemplate(req);
        String id = java.util.UUID.randomUUID().toString();
        templateMapper.insertTemplate(id, tenantId, req.getName(), req.getMode(), coalesce(req.getTypes()),
            req.getDescription(), ZhiyuJsonUtils.toJson(req.getData(), "{}"));
        SceneRubricTemplate created = templateMapper.selectById(id);
        if (created == null) {
            throw new ApiException(500, "internal_error", "创建评分模板失败");
        }
        return toTemplateDto(created);
    }

    @Override
    public RubricTemplateDto updateTemplate(String id, RubricTemplateRequest req) {
        systemGuard.requireTenant();
        systemGuard.requireUser();
        SceneRubricTemplate existing = fetchOwnedTemplate(id);
        validateTemplate(req);
        templateMapper.updateTemplate(id, req.getName(), req.getMode(), coalesce(req.getTypes()),
            req.getDescription(), ZhiyuJsonUtils.toJson(req.getData(), "{}"));
        SceneRubricTemplate updated = templateMapper.selectById(id);
        if (updated == null) {
            throw new ApiException(500, "internal_error", "更新评分模板失败");
        }
        return toTemplateDto(updated);
    }

    @Override
    public String deleteTemplate(String id) {
        systemGuard.requireTenant();
        systemGuard.requireUser();
        SceneRubricTemplate existing = fetchOwnedTemplate(id);
        templateMapper.softDelete(id, existing.getTenantId());
        return id;
    }

    // ---------- 组装 ----------

    private <T> Map<String, List<T>> groupByConfig(List<T> rows) {
        Map<String, List<T>> map = new LinkedHashMap<>();
        for (T row : rows) {
            String configId = readField(row, "configId");
            if (configId != null) {
                map.computeIfAbsent(configId, k -> new ArrayList<>()).add(row);
            }
        }
        return map;
    }

    private List<TaskEvalPointDto> toEvalPointDtos(List<SceneEvalPoint> points) {
        List<TaskEvalPointDto> dtos = new ArrayList<>(points.size());
        for (SceneEvalPoint p : points) {
            TaskEvalPointDto dto = new TaskEvalPointDto();
            dto.setId(p.getId());
            dto.setConfigId(p.getConfigId());
            dto.setName(p.getName());
            dto.setDescription(p.getDescription());
            dto.setSubType(p.getSubType());
            dto.setTypes(p.getTypes());
            dto.setWeight(p.getWeight());
            dto.setScoringMethod(p.getScoringMethod());
            dto.setGradeMapping(parseList(p.getGradeMapping()));
            dto.setKnowledgePointIds(p.getKnowledgePointIds());
            dto.setAbilityPointIds(p.getAbilityPointIds());
            dto.setSortOrder(p.getSortOrder());
            dtos.add(dto);
        }
        return dtos;
    }

    private List<TaskScoreRuleDto> toScoreRuleDtos(List<SceneScoreRule> rules) {
        List<TaskScoreRuleDto> dtos = new ArrayList<>(rules.size());
        for (SceneScoreRule r : rules) {
            TaskScoreRuleDto dto = new TaskScoreRuleDto();
            dto.setId(r.getId());
            dto.setConfigId(r.getConfigId());
            dto.setName(r.getName());
            dto.setDescription(r.getDescription());
            dto.setRule(r.getRule());
            dto.setWeight(r.getWeight());
            dto.setSortOrder(r.getSortOrder());
            dtos.add(dto);
        }
        return dtos;
    }

    private List<TaskReviewStepDto> toReviewStepDtos(List<SceneReviewStep> steps) {
        List<TaskReviewStepDto> dtos = new ArrayList<>(steps.size());
        for (SceneReviewStep s : steps) {
            TaskReviewStepDto dto = new TaskReviewStepDto();
            dto.setId(s.getId());
            dto.setConfigId(s.getConfigId());
            dto.setLabel(s.getLabel());
            dto.setDescription(s.getDescription());
            dto.setEnabled(s.getEnabled());
            dto.setSubjectType(s.getSubjectType());
            dto.setWeight(s.getWeight());
            dto.setSortOrder(s.getSortOrder());
            // assignedUserIds 恒输出（无 omitempty），nil 置空数组
            dto.setAssignedUserIds(s.getAssignedUserIds() == null ? List.of() : s.getAssignedUserIds());
            dtos.add(dto);
        }
        return dtos;
    }

    private RubricTemplateDto toTemplateDto(SceneRubricTemplate t) {
        RubricTemplateDto dto = new RubricTemplateDto();
        dto.setId(t.getId());
        dto.setTenantId(t.getTenantId());
        dto.setName(t.getName());
        dto.setMode(t.getMode());
        dto.setTypes(t.getTypes());
        dto.setDescription(t.getDescription());
        dto.setData(parseMap(t.getData()));
        dto.setIsDeleted(t.getIsDeleted());
        dto.setCreatedAt(t.getCreatedAt());
        dto.setUpdatedAt(t.getUpdatedAt());
        return dto;
    }

    private void validateTemplate(RubricTemplateRequest req) {
        if (req.getName() == null || req.getName().isEmpty()
            || req.getMode() == null || req.getMode().isEmpty()
            || req.getData() == null) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
    }

    private SceneRubricTemplate fetchOwnedTemplate(String id) {
        SceneRubricTemplate t = templateMapper.selectById(id);
        if (t == null) {
            throw new ApiException(404, "not_found", "评分模板不存在");
        }
        String tenantId = systemGuard.requireTenant();
        if (!tenantId.equals(t.getTenantId())) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return t;
    }

    // ---------- 工具 ----------

    private List<Object> parseList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<Object> v = ZhiyuJsonUtils.MAPPER.readValue(json, LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            log.warn("JSON 数组解析失败，降级为空列表 json={}", json, e);
            return new ArrayList<>();
        }
    }

    private Map<String, Object> parseMap(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> v = ZhiyuJsonUtils.MAPPER.readValue(json, MAP_REF);
            return v == null ? new LinkedHashMap<>() : v;
        } catch (Exception e) {
            log.warn("JSON 对象解析失败，降级为空 Map json={}", json, e);
            return new LinkedHashMap<>();
        }
    }

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }

    private String readField(Object row, String field) {
        try {
            var pd = org.springframework.beans.BeanUtils.getPropertyDescriptor(row.getClass(), field);
            if (pd == null || pd.getReadMethod() == null) {
                return null;
            }
            Object v = pd.getReadMethod().invoke(row);
            return v == null ? null : v.toString();
        } catch (Exception e) {
            log.warn("反射读取字段失败 field={} type={}", field, row == null ? null : row.getClass().getSimpleName(), e);
            return null;
        }
    }
}
