package org.dromara.zhiyu.service.impl.scene;

import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.util.ZhiyuJsonUtils;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CloneRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CreateScenarioRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ScenarioDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.UpdateScenarioRequest;
import org.dromara.zhiyu.domain.portal.PortalIndustry;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.domain.portal.PortalScenarioTask;
import org.dromara.zhiyu.domain.portal.PortalViewCounter;
import org.dromara.zhiyu.domain.scene.SceneScenario;
import org.dromara.zhiyu.domain.scene.SceneScenarioTask;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.portal.PortalIndustryMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.mapper.portal.PortalScenarioTaskMapper;
import org.dromara.zhiyu.mapper.portal.PortalViewCounterMapper;
import org.dromara.zhiyu.mapper.scene.SceneCloneMapper;
import org.dromara.zhiyu.mapper.scene.SceneResourceSnapshotMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioTaskMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.scene.ISceneScenarioService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 场景服务实现（对齐 Go scenario_handler.go + service/scenario.go + store/scenarios.go +
 * content_actions.go + scenario_clone.go 语义）。
 *
 * <p>关键对齐点：</p>
 * <ul>
 *   <li>列表租户内可见，默认排除 archived（显式传 status 时精确匹配）；学生强制仅已发布；</li>
 *   <li>状态流转允许表与 Go allowedStatusTransitions 一致，流转用 CAS 更新防并发双发；</li>
 *   <li>发布时版本 NextVersion(+0.1) 并在同一事务内构建/写入资源快照；</li>
 *   <li>克隆事务内复制任务/测评配置/绑定/权重/等级映射，状态重置 draft。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class SceneScenarioServiceImpl implements ISceneScenarioService {

    /** 编码字母表（对齐 Go entityCodeAlphabet） */
    private static final String CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private static final TypeReference<List<String>> STRING_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };

    /** 允许的状态流转（key=当前状态，value=可进入状态集合；对齐 Go allowedStatusTransitions） */
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        ZhiyuStatusConstants.DRAFT, Set.of(ZhiyuStatusConstants.PENDING, "archived"),
        ZhiyuStatusConstants.REJECTED, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.PENDING, "archived"),
        ZhiyuStatusConstants.PENDING, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.APPROVED, ZhiyuStatusConstants.REJECTED),
        ZhiyuStatusConstants.APPROVED, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.PUBLISHED, "archived"),
        ZhiyuStatusConstants.PUBLISHED, Set.of(ZhiyuStatusConstants.DRAFT, "archived"),
        "archived", Set.of(ZhiyuStatusConstants.DRAFT)
    );

    private final SystemGuard systemGuard;
    private final SceneScenarioMapper scenarioMapper;
    private final SceneScenarioTaskMapper taskMapper;
    private final SceneCloneMapper cloneMapper;
    private final SceneResourceSnapshotMapper snapshotMapper;
    private final PortalIndustryMapper industryMapper;
    private final PortalMajorMapper majorMapper;
    private final PortalViewCounterMapper viewCounterMapper;
    private final PortalScenarioTaskMapper portalTaskMapper;
    private final ZhiyuUserMapper userMapper;

    // ---------- 列表 / 详情 ----------

    @Override
    public ListResponse<ScenarioDto> list(String search, String status, String batchId, String careerPositionId,
                                          long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        boolean student = isStudent();
        String effectiveStatus = status;
        if (student) {
            // 学生列表仅见已发布场景（越权加固 A3，对齐 Go forcePublishedForStudent）
            effectiveStatus = ZhiyuStatusConstants.PUBLISHED;
        }

        LambdaQueryBuilder<SceneScenario> wrapper = baseListWrapper(tenantId, search, batchId, careerPositionId, effectiveStatus);
        long total = scenarioMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SceneScenario::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<SceneScenario> rows = scenarioMapper.selectList(wrapper.build());
        return ListResponse.of(assembleList(rows, tenantId), total);
    }

    @Override
    public ScenarioDto get(String id) {
        systemGuard.requireUser();
        SceneScenario scenario = fetchOwned(id);
        // 学生仅可读已发布场景（决策 7：draft 对学生不可见，对齐 Go）
        if (isStudent() && !ZhiyuStatusConstants.PUBLISHED.equals(scenario.getStatus())) {
            throw new ApiException(404, "not_found", "场景方案不存在");
        }
        // 视图计数（对齐 Go recordViewAsync：失败仅记日志不阻塞）
        try {
            scenarioMapper.insertViewLog(id, TenantContext.getUserId(), TenantContext.getTenantId());
            scenarioMapper.incrementViewCounter(id);
        } catch (Exception e) {
            log.warn("record scenario view failed, scenarioId={}", id, e);
        }
        return assembleDetail(scenario, tenantOf(scenario));
    }

    // ---------- 创建 / 更新 / 删除 ----------

    @Override
    public ScenarioDto create(CreateScenarioRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? "V1.0" : req.getVersion();

        String code = generateUniqueCode(tenantId);
        String id = UUID.randomUUID().toString();
        scenarioMapper.insertScenario(id, req.getName(), code, emptyToNull(req.getCoverImage()),
            emptyToNull(req.getCareerPositionId()), coalesce(req.getIndustryIds()), coalesce(req.getProfessionIds()),
            emptyToNull(req.getBatchId()), req.getDifficulty() == null ? 0 : req.getDifficulty(), version,
            emptyToNull(req.getBackground()), emptyToNull(req.getDeliveryGoal()), userId,
            coalesce(req.getCoBuilderIds()), tenantId, "school", null);
        return assembleDetail(fetchOwned(id), tenantId);
    }

    @Override
    public ScenarioDto update(String id, UpdateScenarioRequest req) {
        systemGuard.requireUser();
        SceneScenario existing = fetchOwned(id);
        String tenantId = existing.getTenantId();

        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? existing.getVersion() : req.getVersion();
        int difficulty = req.getDifficulty() == null || req.getDifficulty() == 0
            ? (existing.getDifficulty() == null ? 0 : existing.getDifficulty()) : req.getDifficulty();
        List<String> coBuilderIds = req.getCoBuilderIds() != null ? req.getCoBuilderIds() : existing.getCoBuilderIds();

        String coverImage = req.getCoverImage() != null ? emptyToNull(req.getCoverImage()) : existing.getCoverImage();
        String careerPositionId = req.getCareerPositionId() != null
            ? emptyToNull(req.getCareerPositionId()) : existing.getCareerPositionId();
        List<String> industryIds = req.getIndustryIds() != null ? req.getIndustryIds() : existing.getIndustryIds();
        List<String> professionIds = req.getProfessionIds() != null ? req.getProfessionIds() : existing.getProfessionIds();
        String batchId = req.getBatchId() != null ? emptyToNull(req.getBatchId()) : existing.getBatchId();
        String background = req.getBackground() != null ? emptyToNull(req.getBackground()) : existing.getBackground();
        String deliveryGoal = req.getDeliveryGoal() != null ? emptyToNull(req.getDeliveryGoal()) : existing.getDeliveryGoal();

        scenarioMapper.updateScenario(id, name, coverImage, careerPositionId, coalesce(industryIds),
            coalesce(professionIds), batchId, difficulty, version, background, deliveryGoal, coalesce(coBuilderIds));
        return assembleDetail(fetchOwned(id), tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        systemGuard.requireUser();
        SceneScenario existing = fetchOwned(id);
        if (scenarioMapper.existsEvaluationResults(id)) {
            throw new ApiException(409, "conflict", "该场景已存在测评成绩，无法删除");
        }
        scenarioMapper.unbindTeachingPlanEntries(id, existing.getTenantId());
        scenarioMapper.unbindScheduleEntries(id, existing.getTenantId());
        // 收集任务 ID 供考试安排清理（scenario_tasks 经外键级联删除）
        List<SceneScenarioTask> tasks = taskMapper.selectList(
            QueryBuilder.lambda(SceneScenarioTask.class).eq(SceneScenarioTask::getScenarioId, id).build());
        for (SceneScenarioTask task : tasks) {
            cleanupTaskExamUsages(task.getId());
        }
        taskMapper.delete(QueryBuilder.lambda(SceneScenarioTask.class).eq(SceneScenarioTask::getScenarioId, id).build());
        scenarioMapper.deleteById(id);
        return id;
    }

    // ---------- 状态流转 / 审核 / 邀请 / 克隆 ----------

    @Override
    public ScenarioDto submit(String id) {
        return transition(id, ZhiyuStatusConstants.PENDING);
    }

    @Override
    public ScenarioDto withdraw(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    public ScenarioDto saveDraft(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    public ScenarioDto publish(String id) {
        return transition(id, ZhiyuStatusConstants.PUBLISHED);
    }

    @Override
    public ScenarioDto archive(String id) {
        return transition(id, "archived");
    }

    @Override
    public ScenarioDto unpublish(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    /**
     * 状态流转（对齐 Go ContentActions.transition + store Transition）。
     */
    @Transactional(rollbackFor = Exception.class)
    protected ScenarioDto transition(String id, String toStatus) {
        systemGuard.requireUser();
        SceneScenario scenario = fetchOwned(id);
        String tenantId = systemGuard.requireTenant();
        String currentStatus = scenario.getStatus();

        if (!canTransition(currentStatus, toStatus)) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作（场景方案）");
        }
        // CAS 更新：仅当状态仍为读取时的值才流转，防止并发双发
        int rows = scenarioMapper.casTransition(id, tenantId, currentStatus, toStatus);
        if (rows == 0) {
            throw new ApiException(500, "internal_error", "状态流转失败");
        }
        // 从审批中撤回时，同步删除审批中心对应的待审批记录
        if (ZhiyuStatusConstants.PENDING.equals(currentStatus) && ZhiyuStatusConstants.DRAFT.equals(toStatus)) {
            deletePendingApproval(id);
        }
        // 发布时自动递增版本号并落快照（同一事务，构建失败即回滚）
        if (ZhiyuStatusConstants.PUBLISHED.equals(toStatus)) {
            String version = nextVersion(scenario.getVersion());
            scenarioMapper.bumpVersion(id, version);
            savePublishSnapshot(tenantId, id, version);
        }
        return assembleDetail(fetchOwned(id), tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScenarioDto review(String id, ReviewRequest req) {
        systemGuard.requireUser();
        String toStatus;
        if (ZhiyuStatusConstants.APPROVED.equals(req.getStatus())) {
            toStatus = ZhiyuStatusConstants.APPROVED;
        } else if (ZhiyuStatusConstants.REJECTED.equals(req.getStatus())) {
            toStatus = ZhiyuStatusConstants.REJECTED;
        } else {
            throw new ApiException(400, "bad_request", "无效的审核状态");
        }
        SceneScenario scenario = fetchOwned(id);
        String tenantId = systemGuard.requireTenant();
        // CAS 审核：仅 pending 可审
        int rows = scenarioMapper.casReview(id, tenantId, toStatus);
        if (rows == 0) {
            throw new ApiException(400, "bad_request", "场景方案不存在或不在待处理状态");
        }
        return assembleDetail(fetchOwned(id), tenantId);
    }

    @Override
    public ScenarioDto invite(String id, InviteRequest req) {
        systemGuard.requireUser();
        SceneScenario scenario = fetchOwned(id);
        if (req.getUserId() == null || req.getUserId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        // 协作者必须属于本租户用户，防止跨租户协作者引用
        String tenantId = systemGuard.requireTenant();
        if (!userExistsInTenant(req.getUserId(), tenantId)) {
            throw new ApiException(400, "bad_request", "用户不存在或不属于本租户");
        }
        scenarioMapper.inviteCollaborator(id, req.getUserId());
        return assembleDetail(fetchOwned(id), tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScenarioDto clone(String id, CloneRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        SceneCloneMapper.SourceScenarioRow src = cloneMapper.fetchSource(id);
        if (src == null) {
            throw new ApiException(404, "not_found", "场景方案不存在");
        }
        if (src.getTenantId() != null && !src.getTenantId().equals(tenantId)) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        String newName = req.getName() == null || req.getName().isEmpty() ? src.getName() + " (克隆)" : req.getName();
        String newId = UUID.randomUUID().toString();
        String newCode = generateUniqueCloneCode(tenantId, src.getCode());
        cloneScenarioTree(tenantId, newId, newCode, newName, userId, id, src);
        return assembleDetail(fetchOwned(newId), tenantId);
    }

    // ---------- 快照 ----------

    @Override
    public Map<String, Object> getSnapshot(String id, String version) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        Map<String, Object> bundle = snapshotService().getScenarioBundle(tenantId, id, version);
        if (bundle == null) {
            throw new ApiException(404, "not_found", "资源不存在或未发布");
        }
        if (isStudent()) {
            stripStudentAnswers(bundle);
        }
        return bundle;
    }

    // ---------- 组装 ----------

    private List<ScenarioDto> assembleList(List<SceneScenario> rows, String tenantId) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> ids = rows.stream().map(SceneScenario::getId).toList();
        Set<String> industryIds = new LinkedHashSet<>();
        Set<String> professionIds = new LinkedHashSet<>();
        Set<String> creatorIds = new LinkedHashSet<>();
        for (SceneScenario s : rows) {
            if (s.getIndustryIds() != null) {
                industryIds.addAll(s.getIndustryIds());
            }
            if (s.getProfessionIds() != null) {
                professionIds.addAll(s.getProfessionIds());
            }
            if (s.getCreatorId() != null) {
                creatorIds.addAll(Set.of(s.getCreatorId()));
            }
        }
        Map<String, String> industryNames = industryIds.isEmpty() ? Map.of() : nameMap(industryMapper.selectList(
            QueryBuilder.lambda(PortalIndustry.class).in(PortalIndustry::getId, new ArrayList<>(industryIds)).build()));
        Map<String, String> professionNames = professionIds.isEmpty() ? Map.of() : nameMap(majorMapper.selectList(
            QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, new ArrayList<>(professionIds)).build()));
        Map<String, String> creatorNames = userNameMap(new ArrayList<>(creatorIds));
        Map<String, Long> viewMap = viewCounterMap(ids);
        Map<String, Long> taskCountMap = taskCountMap(ids);

        List<ScenarioDto> items = new ArrayList<>(rows.size());
        for (SceneScenario s : rows) {
            ScenarioDto dto = toDto(s);
            dto.setIndustryNames(mapOrdered(s.getIndustryIds(), industryNames));
            dto.setProfessionNames(mapOrdered(s.getProfessionIds(), professionNames));
            dto.setCreatorName(s.getCreatorId() == null ? null : creatorNames.get(s.getCreatorId()));
            dto.setViewCount(viewMap.getOrDefault(s.getId(), 0L).intValue());
            dto.setTaskCount(taskCountMap.getOrDefault(s.getId(), 0L).intValue());
            items.add(dto);
        }
        return items;
    }

    /** 详情组装（对齐 Go fetchScenario：含行业/专业名称与浏览量；creatorName/taskCount 不返回） */
    private ScenarioDto assembleDetail(SceneScenario s, String tenantId) {
        ScenarioDto dto = toDto(s);
        if (s.getIndustryIds() != null && !s.getIndustryIds().isEmpty()) {
            Map<String, String> industryNames = nameMap(industryMapper.selectList(
                QueryBuilder.lambda(PortalIndustry.class).in(PortalIndustry::getId, s.getIndustryIds()).build()));
            dto.setIndustryNames(mapOrdered(s.getIndustryIds(), industryNames));
        } else {
            dto.setIndustryNames(List.of());
        }
        if (s.getProfessionIds() != null && !s.getProfessionIds().isEmpty()) {
            Map<String, String> professionNames = nameMap(majorMapper.selectList(
                QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, s.getProfessionIds()).build()));
            dto.setProfessionNames(mapOrdered(s.getProfessionIds(), professionNames));
        } else {
            dto.setProfessionNames(List.of());
        }
        dto.setViewCount(viewCounterMap(List.of(s.getId())).getOrDefault(s.getId(), 0L).intValue());
        return dto;
    }

    private ScenarioDto toDto(SceneScenario s) {
        ScenarioDto dto = new ScenarioDto();
        dto.setId(s.getId());
        dto.setName(s.getName());
        dto.setCode(s.getCode());
        dto.setCoverImage(s.getCoverImage());
        dto.setCareerPositionId(s.getCareerPositionId());
        dto.setIndustryIds(s.getIndustryIds());
        dto.setProfessionIds(s.getProfessionIds());
        dto.setBatchId(s.getBatchId());
        dto.setDifficulty(s.getDifficulty());
        dto.setVersion(s.getVersion());
        dto.setStatus(s.getStatus());
        dto.setSourceType(s.getSourceType());
        dto.setSourceEnterpriseId(s.getSourceEnterpriseId());
        dto.setBackground(s.getBackground());
        dto.setDeliveryGoal(s.getDeliveryGoal());
        dto.setCreatorId(s.getCreatorId());
        dto.setCoBuilderIds(s.getCoBuilderIds());
        dto.setCreatedAt(s.getCreatedAt());
        dto.setUpdatedAt(s.getUpdatedAt());
        dto.setPublishTime(s.getPublishTime());
        return dto;
    }

    // ---------- 克隆事务体 ----------

    private void cloneScenarioTree(String tenantId, String newId, String newCode, String newName, String creatorId,
                                   String oldScenarioId, SceneCloneMapper.SourceScenarioRow src) {
        scenarioMapper.insertScenario(newId, newName, newCode, src.getCoverImage(), src.getCareerPositionId(),
            parseStringList(src.getIndustryIds()), parseStringList(src.getProfessionIds()), src.getBatchId(),
            src.getDifficulty() == null ? 0 : src.getDifficulty(), src.getVersion(), src.getBackground(),
            src.getDeliveryGoal(), creatorId, parseStringList(src.getCoBuilderIds()), tenantId, "school", null);

        Map<String, String> taskIdMap = new LinkedHashMap<>();
        for (SceneCloneMapper.TaskSourceRow tr : cloneMapper.fetchTasks(oldScenarioId)) {
            String newTaskId = UUID.randomUUID().toString();
            taskIdMap.put(tr.getId(), newTaskId);
            taskMapper.insertTask(newTaskId, newId, tr.getName(), tr.getCode(),
                tr.getSortOrder() == null ? 0 : tr.getSortOrder(), tr.getDescription(), tr.getDetailedDescription(),
                tr.getDescriptionPdf(), tr.getEstimatedHours(), tr.getTaskType(), tr.getDifficulty(), tr.getBackground(),
                parseStringList(tr.getDependencyIds()), false, null,
                parseStringList(tr.getKnowledgePointIds()), parseStringList(tr.getAbilityPointIds()),
                parseStringList(tr.getResourceIds()), tr.getEvalData(), tenantId);
            cloneTaskDeliverables(tenantId, tr.getId(), newTaskId);
            cloneTaskMethods(tenantId, tr.getId(), newTaskId);
            cloneResourceBindings(tenantId, tr.getId(), newTaskId);
            cloneKnowledgeBindings(tenantId, tr.getId(), newTaskId);
            cloneAbilityBindings(tenantId, tr.getId(), newTaskId);
        }
        // 重映射任务依赖（映射不到的旧依赖直接丢弃）
        for (Map.Entry<String, String> e : taskIdMap.entrySet()) {
            remapDependencyIds(e.getValue(), taskIdMap);
        }
        // 权重（仅克隆映射到新任务的行）
        for (SceneCloneMapper.WeightSourceRow w : cloneMapper.fetchWeights(oldScenarioId)) {
            String newTaskId = taskIdMap.get(w.getTaskId());
            if (newTaskId == null) {
                continue;
            }
            cloneMapper.insertWeight(UUID.randomUUID().toString(), newId, newTaskId, w.getWeight(), tenantId);
        }
        // 等级映射（task_id 可空；非空时须映射到新任务）
        for (SceneCloneMapper.GradeMappingSourceRow g : cloneMapper.fetchGradeMappings(oldScenarioId)) {
            String newTaskId = null;
            if (g.getTaskId() != null && !g.getTaskId().isEmpty()) {
                newTaskId = taskIdMap.get(g.getTaskId());
                if (newTaskId == null) {
                    continue;
                }
            }
            cloneMapper.insertGradeMapping(UUID.randomUUID().toString(), newId, newTaskId, g.getLevel(),
                g.getMinScore(), g.getMaxScore(), g.getDescription(), g.getColor(), tenantId);
        }
    }

    private void cloneTaskDeliverables(String tenantId, String oldTaskId, String newTaskId) {
        for (SceneCloneMapper.DeliverableRow d : cloneMapper.fetchDeliverables(oldTaskId)) {
            cloneMapper.insertDeliverable(UUID.randomUUID().toString(), newTaskId, d.getType(), d.getName(),
                d.getDescription(), d.getEvaluationPoints(), d.getSortOrder(), tenantId);
        }
    }

    private void cloneTaskMethods(String tenantId, String oldTaskId, String newTaskId) {
        for (SceneCloneMapper.MethodSourceRow m : cloneMapper.fetchMethods(oldTaskId, tenantId)) {
            String newConfigId = UUID.randomUUID().toString();
            cloneMapper.insertMethod(newConfigId, tenantId, newTaskId, m.getMethodKey(), m.getWeight(),
                m.getEvalObject(), m.getScoreType(), m.getEvalSubjects(), m.getStandardName(), m.getStandardMode(),
                m.getResourceConfig(), m.getVersion(), m.getIsEnabled());
            for (SceneCloneMapper.EvalPointSourceRow ep : cloneMapper.fetchEvalPoints(m.getId())) {
                cloneMapper.insertEvalPoint(UUID.randomUUID().toString(), tenantId, newConfigId, ep.getName(),
                    ep.getDescription(), ep.getSubType(), toPgArrayLiteral(parseStringList(ep.getTypes())),
                    ep.getWeight(), ep.getScoringMethod(), ep.getGradeMapping(),
                    toPgArrayLiteral(parseStringList(ep.getKnowledgePointIds())),
                    toPgArrayLiteral(parseStringList(ep.getAbilityPointIds())), ep.getSortOrder());
            }
            for (SceneCloneMapper.ScoreRuleSourceRow sr : cloneMapper.fetchScoreRules(m.getId())) {
                cloneMapper.insertScoreRule(UUID.randomUUID().toString(), tenantId, newConfigId, sr.getName(),
                    sr.getDescription(), sr.getRule(), sr.getWeight(), sr.getSortOrder());
            }
            for (SceneCloneMapper.ReviewStepSourceRow rs : cloneMapper.fetchReviewSteps(m.getId())) {
                cloneMapper.insertReviewStep(UUID.randomUUID().toString(), tenantId, newConfigId, rs.getLabel(),
                    rs.getDescription(), rs.getEnabled(), rs.getSubjectType(), rs.getWeight(), rs.getSortOrder());
            }
        }
    }

    private void cloneResourceBindings(String tenantId, String oldTaskId, String newTaskId) {
        for (String targetId : cloneMapper.fetchResourceBindingTargets(oldTaskId)) {
            cloneMapper.insertResourceBinding(UUID.randomUUID().toString(), newTaskId, targetId, tenantId);
        }
    }

    private void cloneKnowledgeBindings(String tenantId, String oldTaskId, String newTaskId) {
        for (String targetId : cloneMapper.fetchKnowledgeBindingTargets(oldTaskId)) {
            cloneMapper.insertKnowledgeBinding(UUID.randomUUID().toString(), newTaskId, targetId, tenantId);
        }
    }

    private void cloneAbilityBindings(String tenantId, String oldTaskId, String newTaskId) {
        for (String targetId : cloneMapper.fetchAbilityBindingTargets(oldTaskId)) {
            cloneMapper.insertAbilityBinding(UUID.randomUUID().toString(), newTaskId, targetId, tenantId);
        }
    }

    private void remapDependencyIds(String newTaskId, Map<String, String> taskIdMap) {
        SceneScenarioTask task = taskMapper.selectById(newTaskId);
        if (task == null || task.getDependencyIds() == null || task.getDependencyIds().isEmpty()) {
            return;
        }
        List<String> newDeps = new ArrayList<>();
        for (String oldId : task.getDependencyIds()) {
            String mapped = taskIdMap.get(oldId);
            if (mapped != null) {
                newDeps.add(mapped);
            }
        }
        cloneMapper.updateDependencyIds(newTaskId, toPgArrayLiteral(newDeps));
    }

    // ---------- 快照保存（发布事务内） ----------

    private void savePublishSnapshot(String tenantId, String scenarioId, String version) {
        String data = snapshotService().buildScenarioBundleJson(tenantId, scenarioId);
        snapshotMapper.saveSnapshot(tenantId, SceneResourceSnapshotMapper.TYPE_SCENARIO, scenarioId, version, data);
    }

    private SceneSnapshotServiceHelper snapshotService() {
        return new SceneSnapshotServiceHelper(snapshotMapper, ZhiyuJsonUtils.MAPPER, STRING_LIST_REF);
    }

    // ---------- 学生剥离 ----------

    private void stripStudentAnswers(Map<String, Object> bundle) {
        Object raw = bundle.get("random_draw_questions");
        if (!(raw instanceof List<?> rows)) {
            return;
        }
        List<Object> cleaned = new ArrayList<>();
        for (Object row : rows) {
            if (row instanceof Map<?, ?> m) {
                Map<String, Object> copy = new LinkedHashMap<>();
                m.forEach((k, v) -> copy.put(String.valueOf(k), v));
                copy.remove("answer");
                cleaned.add(copy);
            } else {
                cleaned.add(row);
            }
        }
        bundle.put("random_draw_questions", cleaned);
    }

    // ---------- 工具 ----------

    /** 快照 bundle 构建辅助（快照读取/发布共用）。 */
    static class SceneSnapshotServiceHelper {
        private final SceneResourceSnapshotMapper mapper;
        private final ObjectMapper objectMapper;
        private final TypeReference<List<String>> stringListRef;

        SceneSnapshotServiceHelper(SceneResourceSnapshotMapper mapper, ObjectMapper objectMapper,
                                   TypeReference<List<String>> stringListRef) {
            this.mapper = mapper;
            this.objectMapper = objectMapper;
            this.stringListRef = stringListRef;
        }

        /** 按 GetBundle 语义取场景 bundle（快照缺档回退 live 现场组装），无结果返回 null。 */
        Map<String, Object> getScenarioBundle(String tenantId, String scenarioId, String version) {
            String v = version;
            if (v == null || v.isEmpty()) {
                v = mapper.selectLatestVersion(tenantId, SceneResourceSnapshotMapper.TYPE_SCENARIO, scenarioId);
            }
            if (v != null && !v.isEmpty()) {
                String data = mapper.selectSnapshotData(tenantId, SceneResourceSnapshotMapper.TYPE_SCENARIO, scenarioId, v);
                if (data != null) {
                    return parseBundle(data);
                }
            }
            // 快照缺档：回退 live（仅当 live status=published 且请求版本与 live 版本一致）
            String scenarioJson = mapper.buildScenarioObj(scenarioId, tenantId);
            if (scenarioJson == null) {
                return null;
            }
            Map<String, Object> scenario = parseObject(scenarioJson);
            Object versionObj = scenario.get("version");
            String liveVersion = versionObj == null ? "" : String.valueOf(versionObj);
            String liveStatus = statusOf(scenario);
            if (!ZhiyuStatusConstants.PUBLISHED.equals(liveStatus)) {
                return null;
            }
            if (version != null && !version.isEmpty() && !version.equals(liveVersion)) {
                return null;
            }
            return buildBundle(tenantId, scenarioId);
        }

        private String statusOf(Map<String, Object> scenario) {
            Object s = scenario.get("status");
            return s == null ? "" : String.valueOf(s);
        }

        /** 构建场景整树 bundle（Map 形状 = 快照 jsonb 原文）。 */
        Map<String, Object> buildBundle(String tenantId, String scenarioId) {
            Map<String, Object> bundle = new LinkedHashMap<>();
            String scenarioJson = mapper.buildScenarioObj(scenarioId, tenantId);
            if (scenarioJson == null) {
                return null;
            }
            bundle.put("scenario", parseObject(scenarioJson));
            bundle.put("scenario_tasks", parseList(mapper.buildScenarioTasks(scenarioId, tenantId)));
            bundle.put("task_evaluation_methods", parseList(mapper.buildEvalMethods(scenarioId, tenantId)));
            bundle.put("task_eval_points", parseList(mapper.buildEvalPoints(scenarioId, tenantId)));
            bundle.put("task_eval_score_rules", parseList(mapper.buildScoreRules(scenarioId, tenantId)));
            bundle.put("task_review_steps", parseList(mapper.buildReviewSteps(scenarioId, tenantId)));
            bundle.put("task_deliverables", parseList(mapper.buildDeliverables(scenarioId)));
            bundle.put("task_resource_bindings", parseList(mapper.buildResourceBindings(scenarioId)));
            bundle.put("task_knowledge_bindings", parseList(mapper.buildKnowledgeBindings(scenarioId)));
            bundle.put("task_ability_bindings", parseList(mapper.buildAbilityBindings(scenarioId)));
            bundle.put("scenario_weight_configs", parseList(mapper.buildWeightConfigs(scenarioId)));
            bundle.put("scenario_grade_mappings", parseList(mapper.buildGradeMappings(scenarioId)));
            bundle.put("knowledge_points", parseList(mapper.buildKnowledgePoints(
                parseStringList(mapper.collectKnowledgePointIds(scenarioId, tenantId)), tenantId)));
            bundle.put("ability_points", parseList(mapper.buildAbilityPoints(
                parseStringList(mapper.collectAbilityPointIds(scenarioId, tenantId)), tenantId)));
            bundle.put("resource_library", parseList(mapper.buildResourceLibrary(
                parseStringList(mapper.collectResourceIds(scenarioId)), tenantId)));
            bundle.put("random_draw_questions", parseList(mapper.buildRandomDrawQuestions(
                collectRandomDrawQuestionIds(scenarioId, tenantId), tenantId)));
            // 关联岗位全树（可空）
            String positionId = mapper.selectCareerPositionId(scenarioId, tenantId);
            if (positionId != null && !positionId.isEmpty()) {
                bundle.put("position", buildPositionBundle(tenantId, positionId));
            }
            return bundle;
        }

        /** 构建场景 bundle 的 JSON 原文（发布落快照用）。 */
        String buildScenarioBundleJson(String tenantId, String scenarioId) {
            Map<String, Object> bundle = buildBundle(tenantId, scenarioId);
            if (bundle == null) {
                throw new ApiException(500, "internal_error", "构建场景快照失败");
            }
            try {
                return objectMapper.writeValueAsString(bundle);
            } catch (Exception e) {
                throw new ApiException(500, "internal_error", "构建场景快照失败");
            }
        }

        /** 岗位全树 bundle。 */
        Map<String, Object> buildPositionBundle(String tenantId, String positionId) {
            Map<String, Object> bundle = new LinkedHashMap<>();
            bundle.put("position", parseObject(mapper.buildPositionObj(positionId, tenantId)));
            bundle.put("career_position_majors", parseList(mapper.buildPositionMajors(positionId)));
            bundle.put("position_responsibilities", parseList(mapper.buildPositionResponsibilities(positionId)));
            bundle.put("position_ability_bindings", parseList(mapper.buildPositionAbilityBindings(positionId)));
            bundle.put("ability_domains", parseList(mapper.buildAbilityDomains(positionId)));
            bundle.put("position_certificates", parseList(mapper.buildPositionCertificates(positionId)));
            bundle.put("certification_rules", parseList(mapper.buildCertificationRules(positionId)));
            bundle.put("certification_weights", parseList(mapper.buildCertificationWeights(positionId)));
            bundle.put("certification_ability_items", parseList(mapper.buildCertificationAbilityItems(positionId)));
            bundle.put("certification_ability_points", parseList(mapper.buildCertificationAbilityPoints(positionId)));
            bundle.put("ability_points", parseList(mapper.buildAbilityPoints(
                parseStringList(mapper.collectPositionAbilityPointIds(positionId)), tenantId)));
            return bundle;
        }

        /** 抽题 ID 收集（resource_config.selectedQuestionIds，camelCase）。 */
        List<String> collectRandomDrawQuestionIds(String scenarioId, String tenantId) {
            List<String> ids = new ArrayList<>();
            Set<String> seen = new LinkedHashSet<>();
            for (String cfg : mapper.selectResourceConfigs(scenarioId, tenantId)) {
                try {
                    Map<String, Object> m = objectMapper.readValue(cfg,
                        new TypeReference<Map<String, Object>>() {
                        });
                    Object raw = m.get("selectedQuestionIds");
                    if (raw instanceof List<?> list) {
                        for (Object item : list) {
                            String s = item == null ? "" : String.valueOf(item);
                            if (!s.isEmpty() && seen.add(s)) {
                                ids.add(s);
                            }
                        }
                    }
                } catch (Exception ignored) {
                    // 解析失败跳过（对齐 Go）
                }
            }
            return ids;
        }

        private Map<String, Object> parseBundle(String json) {
            try {
                return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {
                });
            } catch (Exception e) {
                return null;
            }
        }

        private Map<String, Object> parseObject(String json) {
            if (json == null) {
                return null;
            }
            try {
                return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {
                });
            } catch (Exception e) {
                return new LinkedHashMap<>();
            }
        }

        private List<Object> parseList(String json) {
            if (json == null) {
                return new ArrayList<>();
            }
            try {
                Object v = objectMapper.readValue(json, new TypeReference<List<Object>>() {
                });
                return v == null ? new ArrayList<>() : (List<Object>) v;
            } catch (Exception e) {
                return new ArrayList<>();
            }
        }

        private List<String> parseStringList(String json) {
            if (json == null || json.isBlank()) {
                return new ArrayList<>();
            }
            try {
                List<String> v = objectMapper.readValue(json, stringListRef);
                return v == null ? new ArrayList<>() : v;
            } catch (Exception e) {
                return new ArrayList<>();
            }
        }
    }

    /** 状态流转允许判定。 */
    private boolean canTransition(String from, String to) {
        Set<String> allowed = ALLOWED_TRANSITIONS.get(from);
        return allowed != null && allowed.contains(to);
    }

    /** 删除待审批记录（撤回时；approval_records 表；失败即回滚整个流转事务，对齐 Go）。 */
    private void deletePendingApproval(String scenarioId) {
        scenarioMapper.deletePendingApproval(scenarioId);
    }

    /** 清理任务关联的考试安排及其独占临时考试（对齐 Go CleanupTaskExamUsages，MySQL 删除语句不返回行，先查再删两步）。 */
    private void cleanupTaskExamUsages(String taskId) {
        List<String> examIds = taskMapper.selectTaskExamUsageExamIds(taskId);
        taskMapper.deleteTaskExamUsages(taskId);
        if (examIds != null && !examIds.isEmpty()) {
            taskMapper.deleteOrphanTempExams(examIds);
        }
    }

    /** 校验用户属于当前租户。 */
    private boolean userExistsInTenant(String userId, String tenantId) {
        ZhiyuUser user = userMapper.selectById(userId);
        return user != null && tenantId.equals(user.getTenantId());
    }

    /** 生成场景编码（CJ-8 位随机，租户内唯一，重试 10 次；对齐 Go GenerateUniqueEntityCode）。 */
    private String generateUniqueCode(String tenantId) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder("CJ-");
            for (int j = 0; j < 8; j++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!scenarioMapper.existsCode(tenantId, code)) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成场景编码失败");
    }

    /** 克隆场景编码（srcCode-clone[-N]，对齐 Go GenerateUniqueScenarioCode）。 */
    private String generateUniqueCloneCode(String tenantId, String srcCode) {
        String base = srcCode + "-clone";
        if (!scenarioMapper.existsCode(tenantId, base)) {
            return base;
        }
        for (int i = 2; i < 1000; i++) {
            String candidate = base + "-" + i;
            if (!scenarioMapper.existsCode(tenantId, candidate)) {
                return candidate;
            }
        }
        return base + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    /** 版本递增（V1.0→V1.1，1.9→2.0；对齐 Go NextVersion）。 */
    static String nextVersion(String v) {
        int major = 1;
        int minor = 0;
        String s = v == null ? "" : v.trim();
        // 剥离首尾 v/V 前缀
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
                // 无法解析按 V1.0 起算
            }
        }
        if (parts.length > 1) {
            try {
                minor = Integer.parseInt(parts[1].trim());
            } catch (NumberFormatException ignored) {
                // 无法解析按 0 起算
            }
        }
        minor++;
        if (minor >= 10) {
            major++;
            minor = 0;
        }
        return "V" + major + "." + minor;
    }

    /** 查询记录归属（不存在/他租户按 404/403 处理，对齐 Go Get + verifyTenantOwnership）。 */
    private SceneScenario fetchOwned(String id) {
        SceneScenario scenario = scenarioMapper.selectById(id);
        if (scenario == null) {
            throw new ApiException(404, "not_found", "场景方案不存在");
        }
        verifyTenantOwnership(scenario.getTenantId());
        return scenario;
    }

    private void verifyTenantOwnership(String entityTenantId) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (entityTenantId != null && !entityTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
    }

    private String tenantOf(SceneScenario s) {
        return s.getTenantId();
    }

    private LambdaQueryBuilder<SceneScenario> baseListWrapper(String tenantId, String search, String batchId,
                                                              String careerPositionId, String status) {
        LambdaQueryBuilder<SceneScenario> wrapper = QueryBuilder.lambda(SceneScenario.class)
            .eq(SceneScenario::getTenantId, tenantId);
        if (status != null && !status.isEmpty()) {
            wrapper.eq(SceneScenario::getStatus, status);
        } else {
            wrapper.ne(SceneScenario::getStatus, "archived");
        }
        wrapper.eqIfText(SceneScenario::getBatchId, batchId);
        wrapper.eqIfText(SceneScenario::getCareerPositionId, careerPositionId);
        if (search != null && !search.isEmpty()) {
            wrapper.and(w -> w.like(SceneScenario::getName, search).or().like(SceneScenario::getCode, search));
        }
        return wrapper;
    }

    /** 学生角色判定（对齐 Go middleware.HasRole(claims, RoleStudent)）。 */
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

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = ZhiyuJsonUtils.MAPPER.readValue(json, STRING_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /** 转 JSON 数组文本（MySQL 数组列统一 JSON 存储；PG→MySQL 迁移后 PG 字面量 {..} 写 JSON 列会失败）。 */
    private String toPgArrayLiteral(List<String> list) {
        try {
            return ZhiyuJsonUtils.MAPPER.writeValueAsString(list == null ? List.of() : list);
        } catch (Exception e) {
            return "[]";
        }
    }

    private Map<String, String> nameMap(List<?> rows) {
        Map<String, String> map = new LinkedHashMap<>();
        for (Object row : rows) {
            String id = readField(row, "id");
            String name = readField(row, "name");
            if (id != null && name != null) {
                map.put(id, name);
            }
        }
        return map;
    }

    private Map<String, String> userNameMap(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return userMapper.selectList(
                    QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, ids).build())
                .stream()
                .filter(u -> u.getName() != null)
                .collect(Collectors.toMap(ZhiyuUser::getId, ZhiyuUser::getName));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, Long> viewCounterMap(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            List<PortalViewCounter> counters = viewCounterMapper.selectList(
                QueryBuilder.lambda(PortalViewCounter.class)
                    .eq(PortalViewCounter::getTargetType, "scenario")
                    .in(PortalViewCounter::getTargetId, ids)
                    .build());
            return counters.stream().collect(Collectors.toMap(PortalViewCounter::getTargetId,
                c -> c.getCnt() == null ? 0L : c.getCnt()));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, Long> taskCountMap(List<String> scenarioIds) {
        if (scenarioIds.isEmpty()) {
            return Map.of();
        }
        try {
            List<PortalScenarioTask> tasks = portalTaskMapper.selectList(
                QueryBuilder.lambda(PortalScenarioTask.class).in(PortalScenarioTask::getScenarioId, scenarioIds).build());
            return tasks.stream().collect(Collectors.groupingBy(PortalScenarioTask::getScenarioId, Collectors.counting()));
        } catch (Exception e) {
            return Map.of();
        }
    }

    /** 按 ID 顺序映射名称（未命中元素置空串，对齐 Go COALESCE 空串语义）。 */
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

    private String readField(Object row, String field) {
        try {
            var pd = org.springframework.beans.BeanUtils.getPropertyDescriptor(row.getClass(), field);
            if (pd == null || pd.getReadMethod() == null) {
                return null;
            }
            Object v = pd.getReadMethod().invoke(row);
            return v == null ? null : v.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
