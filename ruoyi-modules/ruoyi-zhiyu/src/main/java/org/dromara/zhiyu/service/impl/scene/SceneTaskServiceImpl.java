package org.dromara.zhiyu.service.impl.scene;

import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CreateScenarioTaskRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ReorderTasksRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ScenarioTaskDto;
import org.dromara.zhiyu.domain.scene.SceneScenario;
import org.dromara.zhiyu.domain.scene.SceneScenarioTask;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioTaskMapper;
import org.dromara.zhiyu.service.scene.ISceneTaskService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 场景任务服务实现（对齐 Go scenario_task_handler.go + service/scenario.go +
 * store/scenario_tasks.go 语义）。
 *
 * <p>关键对齐点：学生仅可查已发布场景的任务（防枚举未发布场景任务）；
 * 列表/详情补充知识点/能力点名称与已启用测评方法摘要（Populate*）。</p>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class SceneTaskServiceImpl implements ISceneTaskService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    private final SceneScenarioTaskMapper taskMapper;
    private final SceneScenarioMapper scenarioMapper;
    private final ZhiyuUserMapper userMapper;

    @Override
    public ListResponse<ScenarioTaskDto> list(String scenarioId, String search, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        // 学生仅可查已发布场景的任务；不带 scenarioId 的列表请求对学生会返回空列表
        if (isStudent()) {
            if (scenarioId == null || scenarioId.isEmpty()) {
                return ListResponse.of(new ArrayList<>(), 0);
            }
            SceneScenario sc = scenarioMapper.selectById(scenarioId);
            if (sc == null || !"published".equals(sc.getStatus())) {
                return ListResponse.of(new ArrayList<>(), 0);
            }
        }

        LambdaQueryBuilder<SceneScenarioTask> wrapper = QueryBuilder.lambda(SceneScenarioTask.class)
            .eq(SceneScenarioTask::getTenantId, tenantId)
            .eqIfText(SceneScenarioTask::getScenarioId, scenarioId);
        if (search != null && !search.isEmpty()) {
            wrapper.and(w -> w.like(SceneScenarioTask::getName, search).or().like(SceneScenarioTask::getCode, search));
        }
        long total = taskMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(SceneScenarioTask::getSortOrder).last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<SceneScenarioTask> rows = taskMapper.selectList(wrapper.build());
        return ListResponse.of(toDtos(rows), total);
    }

    @Override
    public ScenarioTaskDto get(String id) {
        requireUser();
        SceneScenarioTask task = fetchOwned(id);
        // 学生仅可查看已发布场景的任务
        if (isStudent()) {
            SceneScenario sc = scenarioMapper.selectById(task.getScenarioId());
            if (sc == null || !"published".equals(sc.getStatus())) {
                throw new ApiException(404, "not_found", "任务不存在");
            }
        }
        return toDtos(List.of(task)).getFirst();
    }

    @Override
    public ScenarioTaskDto create(CreateScenarioTaskRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getScenarioId() == null || req.getScenarioId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()
            || req.getCode() == null || req.getCode().isEmpty()
            || req.getTaskType() == null || req.getTaskType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String scenarioTenantId = scenarioMapper.selectTenantId(req.getScenarioId());
        if (scenarioTenantId == null) {
            throw new ApiException(404, "not_found", "场景不存在");
        }
        verifyTenantOwnership(scenarioTenantId);

        String id = UUID.randomUUID().toString();
        taskMapper.insertTask(id, req.getScenarioId(), req.getName(), req.getCode(),
            req.getSortOrder() == null ? 0 : req.getSortOrder(), req.getDescription(), req.getDetailedDescription(),
            req.getDescriptionPdf(), req.getEstimatedHours() == null ? BigDecimal.ZERO : req.getEstimatedHours(),
            req.getTaskType(), req.getDifficulty(), req.getBackground(),
            coalesce(req.getDependencyIds()), Boolean.TRUE.equals(req.getIsReferenced()), req.getSourceScenarioId(),
            coalesce(req.getKnowledgePointIds()), coalesce(req.getAbilityPointIds()), coalesce(req.getResourceIds()),
            toJson(req.getEvalData()), scenarioTenantId);
        return toDtos(List.of(fetchOwned(id))).getFirst();
    }

    @Override
    public ScenarioTaskDto update(String id, CreateScenarioTaskRequest req) {
        String tenantId = requireTenant();
        requireUser();
        SceneScenarioTask task = fetchOwned(id);
        if (task.getTenantId() == null) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        verifyTenantOwnership(task.getTenantId());

        // 部分更新兜底：未携带字段回退已有值（防全列覆盖清空）
        applyPartialUpdate(req, task);

        String newScenarioTenantId = scenarioMapper.selectTenantId(req.getScenarioId());
        if (newScenarioTenantId == null) {
            throw new ApiException(404, "not_found", "场景不存在");
        }
        verifyTenantOwnership(newScenarioTenantId);

        int rows = taskMapper.updateTask(id, task.getTenantId(), req.getScenarioId(), req.getName(), req.getCode(),
            req.getSortOrder() == null ? 0 : req.getSortOrder(), req.getDescription(), req.getDetailedDescription(),
            req.getDescriptionPdf(), req.getEstimatedHours() == null ? BigDecimal.ZERO : req.getEstimatedHours(),
            req.getTaskType(), req.getDifficulty(), req.getBackground(),
            coalesce(req.getDependencyIds()), Boolean.TRUE.equals(req.getIsReferenced()), req.getSourceScenarioId(),
            coalesce(req.getKnowledgePointIds()), coalesce(req.getAbilityPointIds()), coalesce(req.getResourceIds()),
            toJson(req.getEvalData()));
        if (rows == 0) {
            throw new ApiException(404, "not_found", "任务不存在");
        }
        return toDtos(List.of(fetchOwned(id))).getFirst();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        requireUser();
        SceneScenarioTask task = fetchOwned(id);
        if (task.getTenantId() == null) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        verifyTenantOwnership(task.getTenantId());
        if (taskMapper.existsEvaluationResults(id)) {
            throw new ApiException(409, "conflict", "该任务已存在测评成绩，无法删除");
        }
        // 清理考试安排与独占临时考试（同事务）
        List<String> examIds = taskMapper.cleanupTaskExamUsages(id);
        if (examIds != null && !examIds.isEmpty()) {
            taskMapper.deleteOrphanTempExams(examIds);
        }
        taskMapper.deleteTask(id, task.getTenantId());
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean reorder(ReorderTasksRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getScenarioId() == null || req.getScenarioId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少场景ID");
        }
        String scenarioTenantId = scenarioMapper.selectTenantId(req.getScenarioId());
        if (scenarioTenantId == null) {
            throw new ApiException(404, "not_found", "场景不存在");
        }
        verifyTenantOwnership(scenarioTenantId);
        if (req.getTaskIds() != null) {
            for (int i = 0; i < req.getTaskIds().size(); i++) {
                taskMapper.reorderTask(req.getTaskIds().get(i), req.getScenarioId(), i);
            }
        }
        return true;
    }

    // ---------- 组装 ----------

    private List<ScenarioTaskDto> toDtos(List<SceneScenarioTask> tasks) {
        populateAbilityPointNames(tasks);
        populateKnowledgePointNames(tasks);
        populateEvalData(tasks);
        List<ScenarioTaskDto> dtos = new ArrayList<>(tasks.size());
        for (SceneScenarioTask t : tasks) {
            ScenarioTaskDto dto = new ScenarioTaskDto();
            dto.setId(t.getId());
            dto.setScenarioId(t.getScenarioId());
            dto.setName(t.getName());
            dto.setCode(t.getCode());
            dto.setSortOrder(t.getSortOrder());
            dto.setDescription(t.getDescription());
            dto.setDetailedDescription(t.getDetailedDescription());
            dto.setDescriptionPdf(t.getDescriptionPdf());
            dto.setEstimatedHours(t.getEstimatedHours());
            dto.setTaskType(t.getTaskType());
            dto.setDifficulty(t.getDifficulty());
            dto.setBackground(t.getBackground());
            dto.setDependencyIds(t.getDependencyIds());
            dto.setIsReferenced(t.getIsReferenced());
            dto.setSourceScenarioId(t.getSourceScenarioId());
            dto.setKnowledgePointIds(t.getKnowledgePointIds());
            dto.setKnowledgePointNames(t.getKnowledgePointNames());
            dto.setAbilityPointIds(t.getAbilityPointIds());
            dto.setAbilityPointNames(t.getAbilityPointNames());
            dto.setResourceIds(t.getResourceIds());
            dto.setEvalData(fromJson(t.getEvalData()));
            dto.setTenantId(t.getTenantId());
            dtos.add(dto);
        }
        return dtos;
    }

    /** 能力点名称（与 ability_point_ids 按序对齐；未命中置空串，对齐 Go）。 */
    private void populateAbilityPointNames(List<SceneScenarioTask> tasks) {
        Set<String> idSet = new LinkedHashSet<>();
        for (SceneScenarioTask t : tasks) {
            if (t.getAbilityPointIds() != null) {
                for (String id : t.getAbilityPointIds()) {
                    if (id != null && !id.isEmpty()) {
                        idSet.add(id);
                    }
                }
            }
        }
        if (idSet.isEmpty()) {
            return;
        }
        Map<String, String> nameById = new HashMap<>();
        try {
            for (SceneScenarioTaskMapper.IdNameRow row : taskMapper.selectAbilityPointNames(new ArrayList<>(idSet))) {
                nameById.put(row.getId(), row.getName());
            }
        } catch (Exception e) {
            log.warn("populate ability point names failed", e);
        }
        for (SceneScenarioTask t : tasks) {
            if (t.getAbilityPointIds() == null || t.getAbilityPointIds().isEmpty()) {
                continue;
            }
            List<String> names = new ArrayList<>(t.getAbilityPointIds().size());
            for (String id : t.getAbilityPointIds()) {
                names.add(nameById.getOrDefault(id, ""));
            }
            t.setAbilityPointNames(names);
        }
    }

    private void populateKnowledgePointNames(List<SceneScenarioTask> tasks) {
        Set<String> idSet = new LinkedHashSet<>();
        for (SceneScenarioTask t : tasks) {
            if (t.getKnowledgePointIds() != null) {
                for (String id : t.getKnowledgePointIds()) {
                    if (id != null && !id.isEmpty()) {
                        idSet.add(id);
                    }
                }
            }
        }
        if (idSet.isEmpty()) {
            return;
        }
        Map<String, String> nameById = new HashMap<>();
        try {
            for (SceneScenarioTaskMapper.IdNameRow row : taskMapper.selectKnowledgePointNames(new ArrayList<>(idSet))) {
                nameById.put(row.getId(), row.getName());
            }
        } catch (Exception e) {
            log.warn("populate knowledge point names failed", e);
        }
        for (SceneScenarioTask t : tasks) {
            if (t.getKnowledgePointIds() == null || t.getKnowledgePointIds().isEmpty()) {
                continue;
            }
            List<String> names = new ArrayList<>(t.getKnowledgePointIds().size());
            for (String id : t.getKnowledgePointIds()) {
                names.add(nameById.getOrDefault(id, ""));
            }
            t.setKnowledgePointNames(names);
        }
    }

    /** 已启用测评方法摘要（evaluationMethods + methodWeights 合并进 evalData）。 */
    private void populateEvalData(List<SceneScenarioTask> tasks) {
        if (tasks.isEmpty()) {
            return;
        }
        List<String> taskIds = tasks.stream().map(SceneScenarioTask::getId).toList();
        Map<String, List<SceneScenarioTaskMapper.MethodSummaryRow>> byTask = new LinkedHashMap<>();
        try {
            for (SceneScenarioTaskMapper.MethodSummaryRow row : taskMapper.selectEnabledMethods(taskIds)) {
                byTask.computeIfAbsent(row.getTaskId(), k -> new ArrayList<>()).add(row);
            }
        } catch (Exception e) {
            log.warn("populate eval data failed", e);
        }
        for (SceneScenarioTask t : tasks) {
            List<SceneScenarioTaskMapper.MethodSummaryRow> rows = byTask.get(t.getId());
            if (rows == null || rows.isEmpty()) {
                continue;
            }
            Map<String, Object> evalData = fromJson(t.getEvalData());
            if (evalData == null) {
                evalData = new LinkedHashMap<>();
            }
            List<String> keys = new ArrayList<>();
            Map<String, Object> weights = new LinkedHashMap<>();
            for (SceneScenarioTaskMapper.MethodSummaryRow row : rows) {
                keys.add(row.getMethodKey());
                weights.put(row.getMethodKey(), row.getWeight());
            }
            evalData.put("evaluationMethods", keys);
            evalData.put("methodWeights", weights);
            t.setEvalData(toJson(evalData));
        }
    }

    private void applyPartialUpdate(CreateScenarioTaskRequest req, SceneScenarioTask task) {
        if (isEmpty(req.getScenarioId())) {
            req.setScenarioId(task.getScenarioId());
        }
        if (isEmpty(req.getName())) {
            req.setName(task.getName());
        }
        if (isEmpty(req.getCode())) {
            req.setCode(task.getCode());
        }
        if (isEmpty(req.getTaskType())) {
            req.setTaskType(task.getTaskType());
        }
        if (req.getDifficulty() == null) {
            req.setDifficulty(task.getDifficulty());
        }
        if (req.getDescription() == null) {
            req.setDescription(task.getDescription());
        }
        if (req.getDetailedDescription() == null) {
            req.setDetailedDescription(task.getDetailedDescription());
        }
        if (req.getDescriptionPdf() == null) {
            req.setDescriptionPdf(task.getDescriptionPdf());
        }
        if (req.getBackground() == null) {
            req.setBackground(task.getBackground());
        }
        if (req.getSourceScenarioId() == null) {
            req.setSourceScenarioId(task.getSourceScenarioId());
        }
        if (req.getSortOrder() == null || req.getSortOrder() == 0) {
            req.setSortOrder(task.getSortOrder() == null ? 0 : task.getSortOrder());
        }
        if (req.getEstimatedHours() == null || req.getEstimatedHours().signum() == 0) {
            req.setEstimatedHours(task.getEstimatedHours() == null ? BigDecimal.ZERO : task.getEstimatedHours());
        }
        if (req.getIsReferenced() == null) {
            req.setIsReferenced(task.getIsReferenced());
        }
        if (req.getDependencyIds() == null) {
            req.setDependencyIds(task.getDependencyIds());
        }
        if (req.getKnowledgePointIds() == null) {
            req.setKnowledgePointIds(task.getKnowledgePointIds());
        }
        if (req.getAbilityPointIds() == null) {
            req.setAbilityPointIds(task.getAbilityPointIds());
        }
        if (req.getResourceIds() == null) {
            req.setResourceIds(task.getResourceIds());
        }
        if (req.getEvalData() == null) {
            req.setEvalData(fromJson(task.getEvalData()));
        }
    }

    // ---------- 工具 ----------

    private SceneScenarioTask fetchOwned(String id) {
        SceneScenarioTask task = taskMapper.selectById(id);
        if (task == null) {
            throw new ApiException(404, "not_found", "任务不存在");
        }
        if (task.getTenantId() == null) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        verifyTenantOwnership(task.getTenantId());
        return task;
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

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(401, "unauthorized", "未授权");
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

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }

    private boolean isEmpty(String s) {
        return s == null || s.isEmpty();
    }

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }

    private String toJson(Map<String, Object> map) {
        try {
            return MAPPER.writeValueAsString(map == null ? Map.of() : map);
        } catch (Exception e) {
            return "{}";
        }
    }

    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, MAP_REF);
        } catch (Exception e) {
            return null;
        }
    }
}
