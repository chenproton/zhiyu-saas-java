package org.dromara.zhiyu.service.impl.evaluation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CourseScoreItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilityAggregateLogDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilityAggregateRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilityResultItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.JobAbilitySummaryItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.LevelMappingDto;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationRule;
import org.dromara.zhiyu.domain.evaluation.EvaluationJobAbilityResult;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationCertificationMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationJobAbilityMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationPortraitMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.evaluation.IEvaluationJobAbilityService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 岗位能力结果服务实现（对齐 Go job_ability_result_handler.go +
 * service/job_ability_aggregator.go + store/job_ability_results.go 语义）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class EvaluationJobAbilityServiceImpl implements IEvaluationJobAbilityService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    /** 系统五档掌握程度代码→分数阈值（无自定义分档时的岗位所需得分） */
    private static final Map<String, BigDecimal> NEED_SCORE_BY_LEVEL = Map.of(
        "understand", BigDecimal.ZERO,
        "comprehend", new BigDecimal("60"),
        "master", new BigDecimal("70"),
        "proficient", new BigDecimal("80"),
        "expert", new BigDecimal("90")
    );

    /** 掌握程度五档（分数→等级固定映射） */
    private static final List<String[]> MASTERY_LEVELS = List.of(
        new String[]{"understand", "了解", "0"},
        new String[]{"comprehend", "理解", "60"},
        new String[]{"master", "掌握", "70"},
        new String[]{"proficient", "熟练", "80"},
        new String[]{"expert", "精通", "90"}
    );

    /** 汇聚去重（同岗位并发只跑一次，对齐 Go aggInFlight） */
    private final SystemGuard systemGuard;
    private final Set<String> aggInFlight = ConcurrentHashMap.newKeySet();

    private final EvaluationJobAbilityMapper jobMapper;
    private final EvaluationCertificationMapper certMapper;
    private final EvaluationPortraitMapper portraitMapper;
    private final ZhiyuUserMapper userMapper;
    private final PlatformTransactionManager txManager;

    // ==================== 列表 / 详情 / 汇总 ====================

    @Override
    public ListResponse<JobAbilityResultItemDto> listResults(String careerPositionId, String userId, String search,
                                                             String grade, int page, int limit) {
        String tenantId = systemGuard.requireTenant();
        String effectiveUserId = userId;
        // 学生仅可查看本人的能力汇聚结果
        if (isStudent()) {
            effectiveUserId = systemGuard.requireUser();
        }
        int safePage = Math.max(page <= 0 ? 1 : page, 1);
        int safeLimit = limit <= 0 ? 50 : Math.min(limit, 200);
        int offset = (safePage - 1) * safeLimit;
        String pattern = search == null || search.isBlank() ? null : "%" + escapeLike(search) + "%";
        long total = jobMapper.countResultPage(tenantId, careerPositionId, effectiveUserId, grade, pattern);
        List<Map<String, Object>> rows = jobMapper.selectResultPage(tenantId, careerPositionId, effectiveUserId,
            grade, pattern, safeLimit, offset);
        List<JobAbilityResultItemDto> items = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            items.add(toResultItem(row));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public JobAbilityResultItemDto getResult(String id) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        Map<String, Object> row = jobMapper.selectResultById(id, tenantId);
        if (row == null) {
            throw new ApiException(404, "not_found", "岗位能力结果不存在");
        }
        // 学生仅可查看本人的能力汇聚结果
        if (isStudent() && !systemGuard.requireUser().equals(str(row.get("user_id")))) {
            throw new ApiException(404, "not_found", "岗位能力结果不存在");
        }
        return toResultItem(row);
    }

    @Override
    public ListResponse<CourseScoreItemDto> courseScores(String userId) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        String effectiveUserId = userId;
        // 学生仅可查看本人的课程成绩
        if (isStudent()) {
            effectiveUserId = systemGuard.requireUser();
        }
        if (effectiveUserId == null || effectiveUserId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        List<Map<String, Object>> rows = jobMapper.listStudentCourseScores(tenantId, effectiveUserId);
        List<CourseScoreItemDto> items = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            CourseScoreItemDto dto = new CourseScoreItemDto();
            dto.setCourseId(str(row.get("course_id")));
            dto.setCourseName(str(row.get("course_name")));
            BigDecimal score = decOrNull(row.get("score"));
            dto.setScore(score == null ? null : score.doubleValue());
            dto.setRank(intOrNull(row.get("rank")));
            dto.setTotal(intOrNull(row.get("total")));
            items.add(dto);
        }
        return ListResponse.of(items, items.size());
    }

    @Override
    public List<JobAbilitySummaryItemDto> summary() {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        List<JobAbilitySummaryItemDto> items = new ArrayList<>();
        for (Map<String, Object> row : jobMapper.summary(tenantId)) {
            JobAbilitySummaryItemDto dto = new JobAbilitySummaryItemDto();
            dto.setPositionId(str(row.get("position_id")));
            dto.setPositionName(str(row.get("position_name")));
            dto.setStudentCount(intOrNull(row.get("student_count")));
            dto.setAvgRate(decOrNull(row.get("avg_rate")));
            items.add(dto);
        }
        return items;
    }

    /** 岗位能力结果条目（含存量行指标回退计算；对齐 Go storedIndicators/computeCompetencyV2） */
    private JobAbilityResultItemDto toResultItem(Map<String, Object> row) {
        JobAbilityResultItemDto dto = new JobAbilityResultItemDto();
        dto.setId(str(row.get("id")));
        dto.setPositionId(str(row.get("career_position_id")));
        dto.setPositionName(str(row.get("position_name")));
        dto.setUserId(str(row.get("user_id")));
        dto.setStudentName(str(row.get("user_name")));
        dto.setStudentId(str(row.get("student_no")));
        dto.setClassName(str(row.get("class_name")));
        dto.setMajorId(str(row.get("major_id")));
        dto.setMajorName(str(row.get("major_name")));
        dto.setDepartment(str(row.get("department_name")));
        dto.setTotalAbilityPoints(intOrNull(row.get("total_ability_points")));
        dto.setAchievedAbilityPoints(intOrNull(row.get("achieved_ability_points")));
        dto.setAchievementRate(decOrNull(row.get("achievement_rate")));
        dto.setGrade(str(row.get("grade")));
        dto.setEvaluationTime(odt(row.get("evaluated_at")));
        List<Object> details = parseObjectList(str(row.get("ability_point_details")));
        dto.setAbilityPointDetails(details);
        dto.setGradeHistory(parseObjectList(str(row.get("grade_history"))));
        // 岗位胜任度/认知得分：优先用落库值；存量行未落库（NULL）时回退实时计算
        BigDecimal storedCompetency = decOrNull(row.get("position_competency"));
        BigDecimal storedCognition = decOrNull(row.get("ability_cognition_score"));
        BigDecimal storedV2 = decOrNull(row.get("position_competency_v2"));
        double[] indicators = computeAbilityIndicators(details);
        dto.setPositionCompetency(storedCompetency != null ? storedCompetency : bigDec(indicators[0]));
        dto.setAbilityCognitionScore(storedCognition != null ? storedCognition : bigDec(indicators[1]));
        dto.setPositionCompetencyV2(storedV2 != null ? storedV2 : bigDec(computeCompetencyV2(details)));
        return dto;
    }

    // ==================== 汇聚 ====================

    /**
     * 汇聚所有已发布认证规则的岗位能力结果（每日定时任务入口；对齐 Go
     * JobAbilityAggregator.AggregateAllPublished）。
     *
     * <p>逐岗位独立汇聚：每岗位一条汇聚日志 + 独立事务（REQUIRES_NEW）；
     * 单岗位失败不中断后续岗位，最终抛首个错误供调用方
     * （定时任务）走重试/告警。</p>
     */
    @Override
    public void aggregateAllPublished() {
        List<Map<String, Object>> targets = certMapper.listPublishedTargets();
        TransactionTemplate txTemplate = new TransactionTemplate(txManager);
        txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        Exception firstErr = null;
        for (Map<String, Object> target : targets) {
            String tenantId = str(target.get("tenant_id"));
            String positionId = str(target.get("position_id"));
            String logId = UUID.randomUUID().toString();
            jobMapper.createAggregateLog(logId, tenantId, positionId);
            try {
                int[] result = txTemplate.execute(status -> aggregatePosition(tenantId, positionId, List.of()));
                jobMapper.finishAggregateLog(logId, "finished",
                    result == null ? 0 : result[0], result == null ? 0 : result[1], null);
            } catch (Exception e) {
                log.error("岗位能力汇聚失败 tenantId={} careerPositionId={}", tenantId, positionId, e);
                try {
                    jobMapper.finishAggregateLog(logId, "failed", 0, 0, e.getMessage());
                } catch (Exception ex) {
                    log.error("更新汇聚日志失败 logId={}", logId, ex);
                }
                if (firstErr == null) {
                    firstErr = e;
                }
            }
        }
        if (firstErr != null) {
            if (firstErr instanceof RuntimeException re) {
                throw re;
            }
            throw new RuntimeException(firstErr);
        }
    }

    @Override
    public Map<String, String> aggregate(JobAbilityAggregateRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 岗位归属校验：仅允许对本租户岗位触发汇聚
        String posTenant = certMapper.positionTenantId(req.getCareerPositionId());
        if (posTenant == null || !posTenant.equals(tenantId)) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        if (!aggInFlight.add(req.getCareerPositionId())) {
            Map<String, String> running = new LinkedHashMap<>();
            running.put("status", "running");
            return running;
        }
        String logId = UUID.randomUUID().toString();
        jobMapper.createAggregateLog(logId, tenantId, req.getCareerPositionId());
        // 异步汇聚（对齐 Go goroutine；失败仅更新日志不阻断响应）
        List<String> userIds = req.getUserIds() == null ? List.of() : req.getUserIds();
        Thread.ofVirtual().start(() -> {
            try {
                int[] result = aggregatePosition(tenantId, req.getCareerPositionId(), userIds);
                jobMapper.finishAggregateLog(logId, "finished", result[0], result[1], null);
            } catch (Exception e) {
                log.error("job ability aggregate failed, logId={}", logId, e);
                try {
                    jobMapper.finishAggregateLog(logId, "failed", 0, 0, e.getMessage());
                } catch (Exception ex) {
                    log.error("finish aggregate log failed, logId={}", logId, ex);
                }
            } finally {
                aggInFlight.remove(req.getCareerPositionId());
            }
        });
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("logId", logId);
        resp.put("status", "running");
        return resp;
    }

    @Override
    public JobAbilityAggregateLogDto aggregateStatus(String careerPositionId, String logId) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (careerPositionId == null || careerPositionId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填参数");
        }
        Map<String, Object> row = (logId != null && !logId.isEmpty())
            ? jobMapper.aggregateLogById(logId, tenantId)
            : jobMapper.recentAggregateLog(tenantId, careerPositionId);
        if (row == null) {
            throw new ApiException(404, "not_found", "暂无汇聚记录");
        }
        JobAbilityAggregateLogDto dto = new JobAbilityAggregateLogDto();
        dto.setId(str(row.get("id")));
        dto.setCareerPositionId(str(row.get("career_position_id")));
        dto.setStatus(str(row.get("status")));
        dto.setStudentCount(intOrNull(row.get("student_count")));
        dto.setUpdatedCount(intOrNull(row.get("updated_count")));
        dto.setErrorMessage(str(row.get("error_message")));
        dto.setStartedAt(odt(row.get("started_at")));
        dto.setFinishedAt(odt(row.get("finished_at")));
        return dto;
    }

    /**
     * 岗位能力汇聚主流程（对齐 Go Aggregator.aggregate：规则+模型 → 候选学生 →
     * 任务得分 → 逐学生计算 upsert → 刷新排名）。
     */
    @Transactional(rollbackFor = Exception.class)
    protected int[] aggregatePosition(String tenantId, String careerPositionId, List<String> userIDs) {
        // 1. 规则 + 能力模型（绑定链/任务链自动带出，权重缺省均分）
        String ruleId = certMapper.ruleIdByPosition(tenantId, careerPositionId);
        List<AggPoint> points = loadAggPoints(tenantId, careerPositionId, ruleId);
        if (points.isEmpty()) {
            return new int[]{0, 0};
        }
        Set<String> taskIdSet = new java.util.LinkedHashSet<>();
        for (AggPoint p : points) {
            for (String taskId : p.taskIds) {
                taskIdSet.add(taskId);
            }
        }
        List<String> taskIds = new ArrayList<>(taskIdSet);
        if (taskIds.isEmpty()) {
            return new int[]{0, 0};
        }
        // 2. 候选学生（指定 userIDs 取交集）
        List<String> studentIds;
        if (!userIDs.isEmpty()) {
            studentIds = userIDs;
        } else {
            studentIds = jobMapper.listCandidateStudents(tenantId, taskIds);
        }
        if (studentIds.isEmpty()) {
            return new int[]{0, 0};
        }
        // 每学生每任务归一化最高得分
        Map<String, BigDecimal> scores = new HashMap<>();
        for (Map<String, Object> row : jobMapper.loadStudentTaskScores(tenantId, taskIds, studentIds)) {
            scores.put(str(row.get("student_id")) + "|" + str(row.get("task_id")), decOrNull(row.get("score")));
        }
        // 学生班级/专业信息
        Map<String, Map<String, Object>> profiles = new HashMap<>();
        for (Map<String, Object> row : portraitMapper.listProfiles(studentIds)) {
            profiles.put(str(row.get("user_id")), row);
        }
        // 3. 逐学生计算并 upsert（同事务）
        int updated = 0;
        for (String studentId : studentIds) {
            if (aggregateStudent(tenantId, careerPositionId, studentId, scores, profiles, points)) {
                updated++;
            }
        }
        // 4. 同岗位下按达标率刷新班级/专业排名
        try {
            jobMapper.refreshRanks(careerPositionId, tenantId);
        } catch (Exception e) {
            log.warn("refresh ranks failed, positionId={}", careerPositionId, e);
        }
        return new int[]{studentIds.size(), updated};
    }

    /** 加载汇聚能力点（对齐 Go aggregate 1 步：LoadModel → aggPoint） */
    private List<AggPoint> loadAggPoints(String tenantId, String careerPositionId, String ruleId) {
        List<Map<String, Object>> bindRows = certMapper.loadModelBindings(careerPositionId, tenantId);
        if (bindRows.isEmpty()) {
            return new ArrayList<>();
        }
        List<AggPoint> points = new ArrayList<>();
        Map<String, Integer> pointIdx = new LinkedHashMap<>();
        for (Map<String, Object> row : bindRows) {
            String apId = str(row.get("ability_point_id"));
            if (pointIdx.containsKey(apId)) {
                continue;
            }
            AggPoint p = new AggPoint();
            p.abilityPointId = apId;
            p.name = str(row.get("name"));
            p.domain = str(row.get("domain_name"));
            p.requiredLevel = str(row.get("required_level"));
            p.weight = decOrNull(row.get("weight"));
            pointIdx.put(apId, points.size());
            points.add(p);
        }
        // 自定义分档
        Map<String, List<LevelMappingDto>> pointLevels = new LinkedHashMap<>();
        for (Map<String, Object> row : certMapper.listPointLevels(tenantId, careerPositionId)) {
            pointLevels.put(str(row.get("ability_point_id")),
                parseLevelMappings(str(row.get("level_mapping"))));
        }
        for (AggPoint p : points) {
            List<LevelMappingDto> lm = pointLevels.get(p.abilityPointId);
            if (lm != null && lm.size() == 5) {
                p.levels = lm;
            }
        }
        List<String> pointIds = points.stream().map(p -> p.abilityPointId).toList();
        // 关联任务（两条链去重）
        Set<String> seen = new java.util.LinkedHashSet<>();
        Map<String, List<String[]>> tasksByPoint = new LinkedHashMap<>();
        for (Map<String, Object> row : certMapper.loadModelTasks(careerPositionId, tenantId, pointIds)) {
            String key = str(row.get("ap_id")) + "|" + str(row.get("task_id"));
            if (seen.add(key)) {
                tasksByPoint.computeIfAbsent(str(row.get("ap_id")), k -> new ArrayList<>()).add(
                    new String[]{str(row.get("task_id"))});
            }
        }
        for (Map<String, Object> row : certMapper.loadModelTasksDirect(careerPositionId, pointIds)) {
            String key = str(row.get("ap_id")) + "|" + str(row.get("task_id"));
            if (seen.add(key)) {
                tasksByPoint.computeIfAbsent(str(row.get("ap_id")), k -> new ArrayList<>()).add(
                    new String[]{str(row.get("task_id"))});
            }
        }
        // 权重：certification_weights（task_id 为 NULL 的行是能力点级权重），缺省均分
        Map<String, BigDecimal> stored = new LinkedHashMap<>();
        if (ruleId != null && !ruleId.isEmpty()) {
            for (Map<String, Object> row : certMapper.loadWeights(ruleId)) {
                String key = str(row.get("ability_point_id")) + "|" + (row.get("task_id") == null ? "" : str(row.get("task_id")));
                stored.put(key, decOrNull(row.get("weight")));
            }
        }
        List<BigDecimal> pointDefaults = splitEvenly(new BigDecimal("100"), points.size());
        for (int i = 0; i < points.size(); i++) {
            AggPoint p = points.get(i);
            BigDecimal w = stored.get(p.abilityPointId + "|");
            p.weight = w != null ? w : pointDefaults.get(i);
            List<String[]> tasks = tasksByPoint.getOrDefault(p.abilityPointId, new ArrayList<>());
            List<BigDecimal> taskDefaults = splitEvenly(new BigDecimal("100"), tasks.size());
            for (int j = 0; j < tasks.size(); j++) {
                BigDecimal tw = stored.get(p.abilityPointId + "|" + tasks.get(j)[0]);
                p.taskIds.add(tasks.get(j)[0]);
                p.taskWeights.add(tw != null ? tw : taskDefaults.get(j));
            }
        }
        return points;
    }

    /** 单学生汇聚计算（对齐 Go aggregateStudentBatch 单学生分支） */
    private boolean aggregateStudent(String tenantId, String careerPositionId, String studentId,
                                     Map<String, BigDecimal> scores, Map<String, Map<String, Object>> profiles,
                                     List<AggPoint> points) {
        List<Map<String, Object>> details = new ArrayList<>();
        List<Boolean> pointValid = new ArrayList<>();
        BigDecimal posWeightedSum = BigDecimal.ZERO;
        BigDecimal posWeightSum = BigDecimal.ZERO;
        BigDecimal cognitionSum = BigDecimal.ZERO;
        BigDecimal cognitionWeight = BigDecimal.ZERO;
        BigDecimal competencySum = BigDecimal.ZERO;
        BigDecimal competencyWeight = BigDecimal.ZERO;
        BigDecimal v2WeightedSum = BigDecimal.ZERO;
        BigDecimal v2WeightSum = BigDecimal.ZERO;
        int achieved = 0;
        for (AggPoint p : points) {
            BigDecimal weightedSum = BigDecimal.ZERO;
            BigDecimal weightSum = BigDecimal.ZERO;
            for (int i = 0; i < p.taskIds.size(); i++) {
                BigDecimal s = scores.get(studentId + "|" + p.taskIds.get(i));
                if (s != null) {
                    weightedSum = weightedSum.add(s.multiply(p.taskWeights.get(i)));
                    weightSum = weightSum.add(p.taskWeights.get(i));
                }
            }
            BigDecimal pointScore = BigDecimal.ZERO;
            boolean valid = weightSum.signum() > 0;
            if (valid) {
                pointScore = weightedSum.divide(weightSum, 2, RoundingMode.HALF_UP);
                posWeightedSum = posWeightedSum.add(pointScore.multiply(p.weight));
                posWeightSum = posWeightSum.add(p.weight);
            }
            // 胜任度（新）：等级距离法，仅有效点参与
            BigDecimal compV2 = BigDecimal.ZERO;
            if (valid && p.weight.signum() > 0) {
                compV2 = new BigDecimal("100").add(
                    levelValue(p.levels, pointScore).subtract(levelRankByCode(p.requiredLevel))
                        .multiply(new BigDecimal("50")));
                if (compV2.signum() < 0) {
                    compV2 = BigDecimal.ZERO;
                }
                v2WeightedSum = v2WeightedSum.add(compV2.multiply(p.weight));
                v2WeightSum = v2WeightSum.add(p.weight);
            }
            // 认知得分：全部权重>0 的点参与（无效点按 0 分计入）。
            // 胜任度（比值法）：分母仅统计「有门槛（need>0）」的能力点权重，
            // 「了解」(need=0) 的点不参与胜任度（不稀释），与回退 computeAbilityIndicators 口径一致。
            if (p.weight.signum() > 0) {
                cognitionSum = cognitionSum.add(pointScore.multiply(p.weight));
                cognitionWeight = cognitionWeight.add(p.weight);
                BigDecimal need = pointCompetencyNeed(p.levels, p.requiredLevel);
                if (need.signum() > 0) {
                    competencyWeight = competencyWeight.add(p.weight);
                    BigDecimal c = pointScore.subtract(need).divide(need, 10, RoundingMode.HALF_UP);
                    if (c.signum() > 0) {
                        competencySum = competencySum.add(c.multiply(p.weight));
                    }
                }
            }
            pointValid.add(valid);
            // 达成判定：自定义分档用配置档位，无配置回退系统五档，无法解析回退 60 分线
            boolean pointAchieved = false;
            if (valid) {
                if (p.levels != null && !p.levels.isEmpty()) {
                    int requiredRank = customLevelRankByCode(p.levels, p.requiredLevel);
                    pointAchieved = requiredRank >= 0 && customLevelRank(p.levels, pointScore) >= requiredRank;
                } else {
                    int requiredRank = masteryCodeRank(p.requiredLevel);
                    if (requiredRank >= 0) {
                        pointAchieved = masteryScoreRank(pointScore) >= requiredRank;
                    } else {
                        pointAchieved = pointScore.compareTo(new BigDecimal("60")) >= 0;
                    }
                }
            }
            if (pointAchieved) {
                achieved++;
            }
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("abilityPointId", p.abilityPointId);
            detail.put("abilityPointName", p.name);
            detail.put("score", round2(pointScore));
            detail.put("weight", p.weight);
            detail.put("requiredLevel", p.requiredLevel);
            detail.put("requiredLevelLabel", masteryCodeLabel(p.requiredLevel));
            detail.put("achieved", pointAchieved);
            detail.put("levelLabel", pointLevelLabel(p.levels, pointScore));
            if (valid) {
                detail.put("competencyV2", round2(compV2));
            }
            details.add(detail);
        }
        if (posWeightSum.signum() == 0) {
            return false; // 无任何有效点则跳过该学生
        }
        BigDecimal rate = round2(posWeightedSum.divide(posWeightSum, 6, RoundingMode.HALF_UP));
        BigDecimal cognition = BigDecimal.ZERO;
        BigDecimal competency = BigDecimal.ZERO;
        if (cognitionWeight.signum() > 0) {
            cognition = round2(cognitionSum.divide(cognitionWeight, 6, RoundingMode.HALF_UP));
        }
        if (competencyWeight.signum() > 0) {
            competency = competencySum.divide(competencyWeight, 6, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal competencyV2 = BigDecimal.ZERO;
        if (v2WeightSum.signum() > 0) {
            competencyV2 = round2(v2WeightedSum.divide(v2WeightSum, 6, RoundingMode.HALF_UP));
        }
        // 能力域汇总
        List<Map<String, Object>> domainScores = new ArrayList<>();
        Map<String, BigDecimal[]> domainAcc = new LinkedHashMap<>();
        List<String> domainOrder = new ArrayList<>();
        for (int i = 0; i < points.size(); i++) {
            if (!pointValid.get(i)) {
                continue;
            }
            String domain = points.get(i).domain;
            BigDecimal[] acc = domainAcc.get(domain);
            if (acc == null) {
                acc = new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO};
                domainAcc.put(domain, acc);
                domainOrder.add(domain);
            }
            BigDecimal dScore = (BigDecimal) details.get(i).get("score");
            acc[0] = acc[0].add(dScore.multiply(points.get(i).weight));
            acc[1] = acc[1].add(points.get(i).weight);
        }
        for (String domain : domainOrder) {
            BigDecimal[] acc = domainAcc.get(domain);
            if (acc[1].signum() == 0) {
                continue;
            }
            BigDecimal score = round2(acc[0].divide(acc[1], 6, RoundingMode.HALF_UP));
            Map<String, Object> ds = new LinkedHashMap<>();
            ds.put("domain", domain);
            ds.put("domainLabel", domain);
            ds.put("score", score);
            ds.put("level", masteryGrade(score));
            domainScores.add(ds);
        }
        Map<String, Object> profile = profiles.getOrDefault(studentId, Map.of());
        // upsert 岗位能力结果
        jobMapper.upsertResult(tenantId, careerPositionId, studentId,
            str(profile.get("class_name")), strOrNull(profile.get("major_id")), str(profile.get("major_name")),
            points.size(), achieved, rate, cognition, competency, competencyV2, null, toJson(details));
        // 同步学生画像（域得分 + 推荐岗位）
        String recommends = toJson(portraitMapper.fetchRecommendPositions(studentId));
        portraitMapper.upsertPortrait(tenantId, studentId, careerPositionId, toJson(domainScores), recommends);
        return true;
    }

    // ==================== 指标回退计算 ====================

    /** 由能力点明细计算岗位胜任度（%）与能力认知得分（0-100）；对齐 Go computeAbilityIndicators。
     *  胜任度分母仅统计「有门槛（need>0）」的能力点权重，「了解」(need=0) 的点不稀释胜任度。 */
    private double[] computeAbilityIndicators(List<Object> details) {
        BigDecimal weightSum = BigDecimal.ZERO;
        BigDecimal competencyWeightSum = BigDecimal.ZERO;
        BigDecimal competency = BigDecimal.ZERO;
        BigDecimal cognition = BigDecimal.ZERO;
        for (Object raw : details) {
            if (!(raw instanceof Map<?, ?> m)) {
                continue;
            }
            BigDecimal score = decOf(m.get("score"));
            BigDecimal weight = decOf(m.get("weight"));
            String requiredLevel = strOf(m.get("requiredLevel"));
            if (weight.signum() <= 0) {
                continue;
            }
            weightSum = weightSum.add(weight);
            BigDecimal need = NEED_SCORE_BY_LEVEL.getOrDefault(requiredLevel, BigDecimal.ZERO);
            if (need.signum() > 0) {
                competencyWeightSum = competencyWeightSum.add(weight);
                BigDecimal c = score.subtract(need).divide(need, 10, RoundingMode.HALF_UP);
                if (c.signum() < 0) {
                    c = BigDecimal.ZERO;
                }
                competency = competency.add(c.multiply(weight));
            }
            cognition = cognition.add(score.multiply(weight));
        }
        if (weightSum.signum() <= 0) {
            return new double[]{0, 0};
        }
        double cog = cognition.divide(weightSum, 10, RoundingMode.HALF_UP).doubleValue();
        if (competencyWeightSum.signum() <= 0) {
            return new double[]{0, cog};
        }
        double comp = competency.divide(competencyWeightSum, 10, RoundingMode.HALF_UP).doubleValue() * 100;
        return new double[]{comp, cog};
    }

    /** 岗位胜任度（新，%）：等级距离法，用于存量行回退；对齐 Go computeCompetencyV2 */
    private double computeCompetencyV2(List<Object> details) {
        BigDecimal weightedSum = BigDecimal.ZERO;
        BigDecimal weightSum = BigDecimal.ZERO;
        for (Object raw : details) {
            if (!(raw instanceof Map<?, ?> m)) {
                continue;
            }
            BigDecimal score = decOf(m.get("score"));
            BigDecimal weight = decOf(m.get("weight"));
            String requiredLevel = strOf(m.get("requiredLevel"));
            if (weight.signum() <= 0) {
                continue;
            }
            weightSum = weightSum.add(weight);
            BigDecimal comp = new BigDecimal("100").add(
                v2DefaultLevelValue(score).subtract(v2LevelRankByCode(requiredLevel))
                    .multiply(new BigDecimal("50")));
            if (comp.signum() < 0) {
                comp = BigDecimal.ZERO;
            }
            weightedSum = weightedSum.add(comp.multiply(weight));
        }
        if (weightSum.signum() <= 0) {
            return 0;
        }
        return weightedSum.divide(weightSum, 10, RoundingMode.HALF_UP).doubleValue();
    }

    private BigDecimal v2LevelRankByCode(String code) {
        return switch (code) {
            case "understand" -> BigDecimal.ONE;
            case "comprehend" -> new BigDecimal("2");
            case "master" -> new BigDecimal("3");
            case "proficient" -> new BigDecimal("4");
            case "expert" -> new BigDecimal("5");
            default -> new BigDecimal("2");
        };
    }

    /** 系统默认档位下的得分→等效等级值（了解[0,59]/理解[60,69]/…/精通[90,100]） */
    private BigDecimal v2DefaultLevelValue(BigDecimal score) {
        double[] bounds = {0, 60, 70, 80, 90, 100};
        double s = score.doubleValue();
        for (int i = 0; i < 5; i++) {
            double min = bounds[i];
            double max = i == 4 ? 100 : bounds[i + 1] - 1;
            if (s >= min && s <= max) {
                return new BigDecimal(String.valueOf(i + 1 + (s - min) / (max - min + 1)));
            }
        }
        return BigDecimal.ZERO;
    }

    // ==================== 汇聚辅助 ====================

    static class AggPoint {
        String abilityPointId;
        String name;
        String domain;
        String requiredLevel;
        BigDecimal weight = BigDecimal.ZERO;
        List<LevelMappingDto> levels;
        List<String> taskIds = new ArrayList<>();
        List<BigDecimal> taskWeights = new ArrayList<>();
    }

    private int masteryScoreRank(BigDecimal score) {
        int rank = 0;
        for (int i = 0; i < MASTERY_LEVELS.size(); i++) {
            if (score.compareTo(new BigDecimal(MASTERY_LEVELS.get(i)[2])) >= 0) {
                rank = i;
            }
        }
        return rank;
    }

    private String masteryGrade(BigDecimal score) {
        return MASTERY_LEVELS.get(masteryScoreRank(score))[1];
    }

    private int masteryCodeRank(String code) {
        for (int i = 0; i < MASTERY_LEVELS.size(); i++) {
            if (MASTERY_LEVELS.get(i)[0].equals(code)) {
                return i;
            }
        }
        return -1;
    }

    private String masteryCodeLabel(String code) {
        int i = masteryCodeRank(code);
        return i >= 0 ? MASTERY_LEVELS.get(i)[1] : "";
    }

    private BigDecimal pointCompetencyNeed(List<LevelMappingDto> levels, String requiredLevel) {
        if (levels != null && !levels.isEmpty()) {
            for (LevelMappingDto l : levels) {
                if (l.getLevel().equals(requiredLevel)) {
                    return l.getMin() == null ? BigDecimal.ZERO : BigDecimal.valueOf(l.getMin());
                }
            }
        }
        return NEED_SCORE_BY_LEVEL.getOrDefault(requiredLevel, BigDecimal.ZERO);
    }

    private BigDecimal levelRankByCode(String code) {
        return switch (code) {
            case "understand" -> BigDecimal.ONE;
            case "comprehend" -> new BigDecimal("2");
            case "master" -> new BigDecimal("3");
            case "proficient" -> new BigDecimal("4");
            case "expert" -> new BigDecimal("5");
            default -> new BigDecimal("2");
        };
    }

    /** 得分→等效等级值（等级轴；对齐 Go levelValue） */
    private BigDecimal levelValue(List<LevelMappingDto> levels, BigDecimal score) {
        double[][] bands = new double[5][2];
        if (levels != null && levels.size() == 5) {
            for (int i = 0; i < 5; i++) {
                bands[i][0] = levels.get(i).getMin() == null ? 0 : levels.get(i).getMin();
                bands[i][1] = levels.get(i).getMax() == null ? 0 : levels.get(i).getMax();
            }
        } else {
            double[] bounds = {0, 60, 70, 80, 90, 100};
            for (int i = 0; i < 5; i++) {
                double max = i == 4 ? 100 : bounds[i + 1] - 1;
                bands[i][0] = bounds[i];
                bands[i][1] = max;
            }
        }
        double s = score.doubleValue();
        if (s < bands[0][0]) {
            return bands[0][0] == 0 ? BigDecimal.ZERO : BigDecimal.valueOf(s / bands[0][0]);
        }
        for (int i = 0; i < 5; i++) {
            if (s >= bands[i][0] && s <= bands[i][1]) {
                return BigDecimal.valueOf(i + 1 + (s - bands[i][0]) / (bands[i][1] - bands[i][0] + 1));
            }
        }
        return BigDecimal.ZERO;
    }

    private int customLevelRank(List<LevelMappingDto> levels, BigDecimal score) {
        int rank = -1;
        for (int i = 0; i < levels.size(); i++) {
            double min = levels.get(i).getMin() == null ? 0 : levels.get(i).getMin();
            if (score.doubleValue() >= min) {
                rank = i;
            }
        }
        return rank;
    }

    private int customLevelRankByCode(List<LevelMappingDto> levels, String code) {
        for (int i = 0; i < levels.size(); i++) {
            if (levels.get(i).getLevel().equals(code)) {
                return i;
            }
        }
        return -1;
    }

    private String pointLevelLabel(List<LevelMappingDto> levels, BigDecimal score) {
        if (levels != null && !levels.isEmpty()) {
            int rank = customLevelRank(levels, score);
            if (rank < 0) {
                return "未达标";
            }
            return masteryCodeLabel(levels.get(rank).getLevel()) + "L" + (rank + 1);
        }
        return masteryGrade(score);
    }

    private List<BigDecimal> splitEvenly(BigDecimal total, int n) {
        List<BigDecimal> parts = new ArrayList<>();
        if (n <= 0) {
            return parts;
        }
        BigDecimal base = total.divide(BigDecimal.valueOf(n), 2, RoundingMode.FLOOR);
        for (int i = 0; i < n; i++) {
            parts.add(base);
        }
        parts.set(0, total.subtract(base.multiply(BigDecimal.valueOf(n - 1L))).setScale(2, RoundingMode.HALF_UP));
        return parts;
    }

    private BigDecimal round2(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    List<LevelMappingDto> parseLevelMappings(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<LevelMappingDto> v = MAPPER.readValue(json,
                new TypeReference<List<LevelMappingDto>>() {
                });
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    List<Object> parseObjectList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<Object> v = MAPPER.readValue(json, OBJECT_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    String toJson(Object v) {
        try {
            return MAPPER.writeValueAsString(v);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
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

    private BigDecimal bigDec(double d) {
        return BigDecimal.valueOf(d).setScale(2, RoundingMode.HALF_UP);
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private String strOrNull(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private Integer intOrNull(Object o) {
        return o == null ? null : ((Number) o).intValue();
    }

    private BigDecimal decOrNull(Object o) {
        return o == null ? null : new BigDecimal(o.toString());
    }

    private BigDecimal decOf(Object o) {
        if (o == null) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(o.toString());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private String strOf(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private OffsetDateTime odt(Object o) {
        return o instanceof OffsetDateTime odt ? odt : null;
    }
}
