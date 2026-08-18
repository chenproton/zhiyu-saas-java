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
import org.dromara.zhiyu.domain.scene.SceneRubricTemplate;
import org.dromara.zhiyu.domain.scene.SceneScoreRule;
import org.dromara.zhiyu.mapper.scene.SceneEvalMethodMapper;
import org.dromara.zhiyu.mapper.scene.SceneEvalPointMapper;
import org.dromara.zhiyu.mapper.scene.SceneReviewStepMapper;
import org.dromara.zhiyu.mapper.scene.SceneScoreRuleMapper;
import org.dromara.zhiyu.mapper.scene.SceneRubricTemplateMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioTaskMapper;
import org.dromara.zhiyu.service.scene.ISceneEvalMethodService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 任务测评方式 + 评分模板服务实现（对齐 Go task_evaluation_handler.go +
 * service/task_evaluation.go + store/task_evaluation.go 语义）。
 *
 * <p>关键对齐点：</p>
 * <ul>
 *   <li>ListMethods 返回任务全部方法（启用+禁用），评估点/评分规则/评审步骤按 config_id 批量组装；</li>
 *   <li>SaveMethods 乐观锁（advisory 锁 + MAX(version) 严格大于判定）+ 方法行 upsert +
 *       子表先删后插（仅重写 payload 内方法，不触碰 payload 之外的方法）；</li>
 *   <li>临时考试联动（paper/question_bank/quiz 的 exam_usages 维护）依赖未翻译的测评域，暂缓实现；</li>
 *   <li>评价标准为纯复制语义：rubric_template_id 恒不写入。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class SceneEvalMethodServiceImpl implements ISceneEvalMethodService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Object>> LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    private final SceneEvalMethodMapper evalMethodMapper;
    private final SceneEvalPointMapper evalPointMapper;
    private final SceneScoreRuleMapper scoreRuleMapper;
    private final SceneReviewStepMapper reviewStepMapper;
    private final SceneRubricTemplateMapper templateMapper;
    private final SceneScenarioTaskMapper taskMapper;

    // ---------- 测评方式 ----------

    @Override
    public EvalMethodListResponse listMethods(String taskId) {
        String tenantId = requireTenant();
        requireUser();
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
        String tenantId = requireTenant();
        String creatorId = requireUser();

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
        // 临时考试联动（EnsureExamUsageForMethod）依赖未翻译的测评域（exams/exam_usages 维护），暂缓

        for (TaskEvaluationMethodInput input : req.getMethods() == null ? List.<TaskEvaluationMethodInput>of() : req.getMethods()) {
            boolean enabled = Boolean.TRUE.equals(input.getIsEnabled());
            String configId = evalMethodMapper.upsertMethodReturnId(tenantId, taskId,
                input.getMethodKey(), input.getWeight() == null ? BigDecimal.ZERO : input.getWeight(),
                input.getEvalObject(), input.getScoreType(),
                toJson(input.getEvalSubjects(), "[]"),
                input.getStandardName(), input.getStandardMode(),
                toJson(input.getResourceConfig(), "{}"),
                newVersion, enabled);
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
                    ep.getScoringMethod(), toJson(ep.getGradeMapping(), "[]"),
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

    // ---------- 评分模板 ----------

    @Override
    public ListResponse<RubricTemplateDto> listTemplates(String keyword, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
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
        requireTenant();
        SceneRubricTemplate t = fetchOwnedTemplate(id);
        return toTemplateDto(t);
    }

    @Override
    public RubricTemplateDto createTemplate(RubricTemplateRequest req) {
        String tenantId = requireTenant();
        requireUser();
        validateTemplate(req);
        String id = java.util.UUID.randomUUID().toString();
        templateMapper.insertTemplate(id, tenantId, req.getName(), req.getMode(), coalesce(req.getTypes()),
            req.getDescription(), toJson(req.getData(), "{}"));
        SceneRubricTemplate created = templateMapper.selectById(id);
        if (created == null) {
            throw new ApiException(500, "internal_error", "创建评分模板失败");
        }
        return toTemplateDto(created);
    }

    @Override
    public RubricTemplateDto updateTemplate(String id, RubricTemplateRequest req) {
        requireTenant();
        requireUser();
        SceneRubricTemplate existing = fetchOwnedTemplate(id);
        validateTemplate(req);
        templateMapper.updateTemplate(id, req.getName(), req.getMode(), coalesce(req.getTypes()),
            req.getDescription(), toJson(req.getData(), "{}"));
        SceneRubricTemplate updated = templateMapper.selectById(id);
        if (updated == null) {
            throw new ApiException(500, "internal_error", "更新评分模板失败");
        }
        return toTemplateDto(updated);
    }

    @Override
    public String deleteTemplate(String id) {
        requireTenant();
        requireUser();
        fetchOwnedTemplate(id);
        templateMapper.softDelete(id);
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
        String tenantId = requireTenant();
        if (!tenantId.equals(t.getTenantId())) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return t;
    }

    // ---------- 工具 ----------

    private String toJson(Object value, String fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return MAPPER.writeValueAsString(value);
        } catch (Exception e) {
            return fallback;
        }
    }

    private List<Object> parseList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<Object> v = MAPPER.readValue(json, LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private Map<String, Object> parseMap(String json) {
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

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
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
