package org.dromara.zhiyu.service.impl.evaluation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationAbilityItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationAbilityPointDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationFullItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationFullPointDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationFullRuleResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationModelDomainDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationModelPointDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationModelTaskDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationPositionModelDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationRelatedTaskDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationRuleDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationTaskRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationWeightsPayload;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateCertificationItemRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateCertificationPointRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateCertificationRuleRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.LevelMappingDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.PutFullCertificationItemRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.PutFullCertificationPointRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.PutFullCertificationRuleRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.PutPointLevelsRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.RuleRefDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StatusRequest;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationItem;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationPoint;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationPointLevel;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationRule;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationTask;
import org.dromara.zhiyu.mapper.evaluation.EvaluationCertificationItemMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationCertificationMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationCertificationPointMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationCertificationTaskMapper;
import org.dromara.zhiyu.service.evaluation.IEvaluationCertificationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 认证规则服务实现（对齐 Go certification_handler.go + certification_model_handler.go +
 * service/evaluation_cert.go + store/certifications.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class EvaluationCertificationServiceImpl implements IEvaluationCertificationService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<List<LevelMappingDto>> LEVEL_MAPPING_REF = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    /** 掌握程度五档代码顺序（分档配置必须按此顺序；对齐 Go masteryLevelOrder） */
    private static final List<String> MASTERY_LEVEL_ORDER =
        List.of("understand", "comprehend", "master", "proficient", "expert");

    private final EvaluationCertificationMapper certMapper;
    private final EvaluationCertificationItemMapper itemMapper;
    private final EvaluationCertificationPointMapper pointMapper;
    private final EvaluationCertificationTaskMapper taskMapper;

    // ==================== 规则 ====================

    @Override
    public ListResponse<CertificationRuleDto> listRules(String careerPositionId, String status, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<EvaluationCertificationRule> wrapper = QueryBuilder.lambda(EvaluationCertificationRule.class)
            .eq(EvaluationCertificationRule::getTenantId, tenantId);
        if (careerPositionId != null && !careerPositionId.isBlank()) {
            wrapper.eq(EvaluationCertificationRule::getCareerPositionId, careerPositionId);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(EvaluationCertificationRule::getStatus, status);
        }
        long total = certMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationCertificationRule::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationCertificationRule> rows = certMapper.selectList(wrapper.build());
        return ListResponse.of(rows.stream().map(this::toRuleDto).toList(), total);
    }

    @Override
    public CertificationRuleDto getRule(String id) {
        requireUser();
        return toRuleDto(fetchRule(id));
    }

    @Override
    public CertificationRuleDto createRule(CreateCertificationRuleRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 岗位必须属于当前租户
        checkPositionTenant(tenantId, req.getCareerPositionId());
        // 同一租户同一岗位只允许一条规则：已存在则直接返回
        String existingId = certMapper.ruleIdByPosition(tenantId, req.getCareerPositionId());
        if (existingId != null) {
            return toRuleDto(fetchRule(existingId));
        }
        String id = UUID.randomUUID().toString();
        certMapper.insertRule(id, tenantId, req.getCareerPositionId(),
            req.getRuleSource() == null ? "custom" : req.getRuleSource());
        return toRuleDto(fetchRule(id));
    }

    @Override
    public CertificationRuleDto updateRule(String id, CreateCertificationRuleRequest req) {
        requireUser();
        fetchRule(id);
        String tenantId = requireTenant();
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        checkPositionTenant(tenantId, req.getCareerPositionId());
        certMapper.updateRule(id, tenantId, req.getCareerPositionId(),
            req.getRuleSource() == null ? "custom" : req.getRuleSource());
        return toRuleDto(fetchRule(id));
    }

    @Override
    public CertificationRuleDto updateRuleStatus(String id, StatusRequest req) {
        requireUser();
        fetchRule(id);
        String tenantId = requireTenant();
        if (!"draft".equals(req.getStatus()) && !"published".equals(req.getStatus())) {
            throw new ApiException(400, "bad_request", "状态仅支持 draft/published");
        }
        certMapper.updateRuleStatus(id, tenantId, req.getStatus());
        return toRuleDto(fetchRule(id));
    }

    @Override
    public String deleteRule(String id) {
        requireUser();
        fetchRule(id);
        String tenantId = requireTenant();
        certMapper.delete(QueryBuilder.lambda(EvaluationCertificationRule.class)
            .eq(EvaluationCertificationRule::getId, id)
            .eq(EvaluationCertificationRule::getTenantId, tenantId).build());
        return id;
    }

    // ==================== 能力项 ====================

    @Override
    public ListResponse<CertificationAbilityItemDto> listItems(String ruleId) {
        requireUser();
        List<EvaluationCertificationItem> rows = itemMapper.selectList(
            QueryBuilder.lambda(EvaluationCertificationItem.class)
                .eq(EvaluationCertificationItem::getRuleId, ruleId)
                .orderByAsc(EvaluationCertificationItem::getSortOrder).build());
        List<CertificationAbilityItemDto> items = rows.stream().map(this::toItemDto).toList();
        return ListResponse.of(items, items.size());
    }

    @Override
    public CertificationAbilityItemDto createItem(String ruleId, CreateCertificationItemRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String id = UUID.randomUUID().toString();
        certMapper.insertItem(id, tenantId, ruleId, req.getName(), req.getSortOrder() == null ? 0 : req.getSortOrder());
        return toItemDto(fetchItem(id));
    }

    @Override
    public CertificationAbilityItemDto updateItem(String id, CreateCertificationItemRequest req) {
        requireUser();
        fetchItem(id);
        String tenantId = requireTenant();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        certMapper.updateItem(id, tenantId, req.getName(), req.getSortOrder() == null ? 0 : req.getSortOrder());
        return toItemDto(fetchItem(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deleteItem(String id) {
        requireUser();
        fetchItem(id);
        String tenantId = requireTenant();
        certMapper.deletePointsByItem(id, tenantId);
        itemMapper.delete(QueryBuilder.lambda(EvaluationCertificationItem.class)
            .eq(EvaluationCertificationItem::getId, id)
            .eq(EvaluationCertificationItem::getTenantId, tenantId).build());
        return id;
    }

    // ==================== 能力点 ====================

    @Override
    public ListResponse<CertificationAbilityPointDto> listPoints(String itemId) {
        requireUser();
        List<EvaluationCertificationPoint> rows = pointMapper.selectList(
            QueryBuilder.lambda(EvaluationCertificationPoint.class)
                .eq(EvaluationCertificationPoint::getItemId, itemId)
                .orderByAsc(EvaluationCertificationPoint::getId).build());
        List<CertificationAbilityPointDto> items = rows.stream().map(this::toPointDto).toList();
        return ListResponse.of(items, items.size());
    }

    @Override
    public CertificationAbilityPointDto createPoint(String itemId, CreateCertificationPointRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getAbilityPointId() == null || req.getAbilityPointId().isEmpty()
            || req.getRequiredLevel() == null || req.getRequiredLevel().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 能力点必须存在且属于本租户，防止悬挂/跨租户引用
        if (!certMapper.abilityPointExists(req.getAbilityPointId(), tenantId)) {
            throw new ApiException(400, "bad_request", "能力点不存在或不属于本租户");
        }
        String id = UUID.randomUUID().toString();
        certMapper.insertPoint(id, tenantId, itemId, req.getAbilityPointId(),
            req.getMappingType() == null ? "inherit" : req.getMappingType(),
            toJson(coalesceLevels(req.getCustomLevelMapping())),
            req.getRequiredLevel(), req.getWeight() == null ? BigDecimal.ZERO : req.getWeight());
        return toPointDto(fetchPoint(id));
    }

    @Override
    public CertificationAbilityPointDto updatePoint(String id, CreateCertificationPointRequest req) {
        requireUser();
        fetchPoint(id);
        String tenantId = requireTenant();
        if (req.getRequiredLevel() == null || req.getRequiredLevel().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        certMapper.updatePoint(id, tenantId,
            req.getMappingType() == null ? "inherit" : req.getMappingType(),
            toJson(coalesceLevels(req.getCustomLevelMapping())),
            req.getRequiredLevel(), req.getWeight() == null ? BigDecimal.ZERO : req.getWeight());
        return toPointDto(fetchPoint(id));
    }

    @Override
    public String deletePoint(String id) {
        requireUser();
        fetchPoint(id);
        String tenantId = requireTenant();
        pointMapper.delete(QueryBuilder.lambda(EvaluationCertificationPoint.class)
            .eq(EvaluationCertificationPoint::getId, id)
            .eq(EvaluationCertificationPoint::getTenantId, tenantId).build());
        return id;
    }

    // ==================== 关联任务 ====================

    @Override
    public CertificationRelatedTaskDto createTask(String pointId, CertificationTaskRequest req) {
        String tenantId = requireTenant();
        requireUser();
        fetchPoint(pointId);
        if (req.getTaskId() == null || req.getTaskId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String id = UUID.randomUUID().toString();
        certMapper.insertTask(id, tenantId, pointId, req.getTaskId(),
            req.getMaxScore() == null ? new BigDecimal("100") : req.getMaxScore(),
            req.getWeight() == null ? BigDecimal.ZERO : req.getWeight());
        return toTaskDto(fetchTask(id));
    }

    @Override
    public CertificationRelatedTaskDto updateTask(String id, CertificationTaskRequest req) {
        requireUser();
        fetchTask(id);
        String tenantId = requireTenant();
        certMapper.updateTask(id, tenantId, req.getTaskId(),
            req.getMaxScore() == null ? new BigDecimal("100") : req.getMaxScore(),
            req.getWeight() == null ? BigDecimal.ZERO : req.getWeight());
        return toTaskDto(fetchTask(id));
    }

    @Override
    public String deleteTask(String id) {
        requireUser();
        fetchTask(id);
        String tenantId = requireTenant();
        taskMapper.delete(QueryBuilder.lambda(EvaluationCertificationTask.class)
            .eq(EvaluationCertificationTask::getId, id)
            .eq(EvaluationCertificationTask::getTenantId, tenantId).build());
        return id;
    }

    // ==================== 完整规则 ====================

    @Override
    public CertificationFullRuleResponse getFullRule(String id) {
        requireUser();
        CertificationRuleDto rule = toRuleDto(fetchRule(id));
        List<Map<String, Object>> itemRows = certMapper.listFullItems(id);
        List<String> itemIds = itemRows.stream().map(r -> str(r.get("id"))).toList();
        List<Map<String, Object>> pointRows = itemIds.isEmpty() ? List.of() : certMapper.listFullPoints(itemIds);
        List<String> pointIds = pointRows.stream().map(r -> str(r.get("id"))).toList();
        Map<String, List<Map<String, Object>>> taskMap = new LinkedHashMap<>();
        if (!pointIds.isEmpty()) {
            for (Map<String, Object> t : certMapper.listTasksByPointIds(pointIds)) {
                taskMap.computeIfAbsent(str(t.get("cert_point_id")), k -> new ArrayList<>()).add(t);
            }
        }
        // 组装：item → points（含 tasks）
        List<CertificationFullItemDto> fullItems = new ArrayList<>();
        for (Map<String, Object> it : itemRows) {
            CertificationFullItemDto item = new CertificationFullItemDto();
            item.setId(str(it.get("id")));
            item.setName(str(it.get("name")));
            item.setSortOrder(intOrNull(it.get("sort_order")));
            item.setAbilityName(str(it.get("ability_name")));
            List<CertificationFullPointDto> pts = new ArrayList<>();
            for (Map<String, Object> p : pointRows) {
                if (!str(p.get("item_id")).equals(str(it.get("id")))) {
                    continue;
                }
                CertificationFullPointDto pt = new CertificationFullPointDto();
                pt.setId(str(p.get("id")));
                pt.setName(str(p.get("name")));
                pt.setDescription(str(p.get("description")));
                pt.setMappingType(str(p.get("mapping_type")));
                pt.setCustomLevelMapping(parseLevelMappings(str(p.get("custom_level_mapping"))));
                pt.setRequiredLevel(str(p.get("required_level")));
                pt.setWeight(decOrNull(p.get("weight")));
                List<CertificationRelatedTaskDto> tasks = new ArrayList<>();
                for (Map<String, Object> t : taskMap.getOrDefault(str(p.get("id")), List.of())) {
                    CertificationRelatedTaskDto td = new CertificationRelatedTaskDto();
                    td.setId(str(t.get("id")));
                    td.setCertPointId(str(t.get("cert_point_id")));
                    td.setTaskId(str(t.get("task_id")));
                    td.setMaxScore(decOrNull(t.get("max_score")));
                    td.setWeight(decOrNull(t.get("weight")));
                    tasks.add(td);
                }
                pt.setTasks(tasks);
                pts.add(pt);
            }
            item.setPoints(pts);
            fullItems.add(item);
        }
        CertificationFullRuleResponse resp = new CertificationFullRuleResponse();
        resp.setRule(rule);
        resp.setItems(fullItems);
        return resp;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CertificationRuleDto putFullRule(String id, PutFullCertificationRuleRequest req) {
        requireUser();
        fetchRule(id);
        String tenantId = requireTenant();
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        checkPositionTenant(tenantId, req.getCareerPositionId());
        for (PutFullCertificationItemRequest item : coalesceItems(req.getItems())) {
            if (item.getName() == null || item.getName().isEmpty()) {
                throw new ApiException(400, "bad_request", "缺少必填字段");
            }
            for (PutFullCertificationPointRequest point : coalescePoints(item.getPoints())) {
                if (point.getAbilityPointId() == null || point.getAbilityPointId().isEmpty()
                    || point.getRequiredLevel() == null || point.getRequiredLevel().isEmpty()) {
                    throw new ApiException(400, "bad_request", "缺少必填字段");
                }
                if (!validateTaskWeights(coalesceTasks(point.getTasks()))) {
                    throw new ApiException(400, "bad_request", "关联任务权重之和必须等于 100");
                }
            }
        }
        certMapper.updateRuleFull(id, tenantId, req.getCareerPositionId(),
            req.getRuleSource() == null ? "custom" : req.getRuleSource(),
            toJson(coalesceLevels(req.getLevelMapping())));
        certMapper.deleteItemsByRule(id, tenantId);
        for (PutFullCertificationItemRequest item : coalesceItems(req.getItems())) {
            String itemId = UUID.randomUUID().toString();
            certMapper.insertItem(itemId, tenantId, id, item.getName(),
                item.getSortOrder() == null ? 0 : item.getSortOrder());
            for (PutFullCertificationPointRequest point : coalescePoints(item.getPoints())) {
                String pointId = UUID.randomUUID().toString();
                certMapper.insertPoint(pointId, tenantId, itemId, point.getAbilityPointId(),
                    point.getMappingType() == null ? "inherit" : point.getMappingType(),
                    toJson(coalesceLevels(point.getCustomLevelMapping())),
                    point.getRequiredLevel(), point.getWeight() == null ? BigDecimal.ZERO : point.getWeight());
                for (CertificationTaskRequest task : coalesceTasks(point.getTasks())) {
                    certMapper.insertTask(UUID.randomUUID().toString(), tenantId, pointId, task.getTaskId(),
                        task.getMaxScore() == null ? new BigDecimal("100") : task.getMaxScore(),
                        task.getWeight() == null ? BigDecimal.ZERO : task.getWeight());
                }
            }
        }
        return toRuleDto(fetchRule(id));
    }

    // ==================== 岗位能力模型 ====================

    @Override
    public CertificationPositionModelDto getPositionModel(String positionId) {
        String tenantId = requireTenant();
        requireUser();
        Map<String, Object> ruleRow = certMapper.findPositionRule(tenantId, positionId);
        RuleRefDto rule = null;
        String ruleId = "";
        if (ruleRow != null) {
            rule = new RuleRefDto();
            rule.setId(str(ruleRow.get("id")));
            rule.setStatus(str(ruleRow.get("status")));
            ruleId = str(ruleRow.get("id"));
        }
        List<CertificationModelDomainDto> domains = loadModel(tenantId, positionId, ruleId);
        CertificationPositionModelDto dto = new CertificationPositionModelDto();
        dto.setRule(rule);
        dto.setPositionId(positionId);
        dto.setDomains(domains);
        return dto;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CertificationRuleDto putWeights(String positionId, CertificationWeightsPayload req) {
        String tenantId = requireTenant();
        requireUser();
        checkPositionTenant(tenantId, positionId);
        // 校验权重和
        BigDecimal pointSum = BigDecimal.ZERO;
        List<org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationPointWeightDto> pointWeights =
            coalescePointWeights(req.getPointWeights());
        for (var pw : pointWeights) {
            if (pw.getAbilityPointId() == null || pw.getAbilityPointId().isEmpty()) {
                throw new ApiException(400, "bad_request", "缺少必填字段");
            }
            pointSum = pointSum.add(pw.getWeight() == null ? BigDecimal.ZERO : pw.getWeight());
        }
        if (!pointWeights.isEmpty() && pointSum.compareTo(new BigDecimal("100")) != 0) {
            throw new ApiException(400, "bad_request", "能力点权重之和必须等于 100");
        }
        Map<String, BigDecimal> taskSums = new LinkedHashMap<>();
        for (var tw : coalesceTaskWeights(req.getTaskWeights())) {
            if (tw.getAbilityPointId() == null || tw.getAbilityPointId().isEmpty()
                || tw.getTaskId() == null || tw.getTaskId().isEmpty()) {
                throw new ApiException(400, "bad_request", "缺少必填字段");
            }
            taskSums.merge(tw.getAbilityPointId(), tw.getWeight() == null ? BigDecimal.ZERO : tw.getWeight(),
                BigDecimal::add);
        }
        for (BigDecimal sum : taskSums.values()) {
            if (sum.compareTo(new BigDecimal("100")) != 0) {
                throw new ApiException(400, "bad_request", "关联任务权重之和必须等于 100");
            }
        }
        // 查规则（无则自动建 draft custom 规则）
        String ruleId = certMapper.ruleIdByPosition(tenantId, positionId);
        if (ruleId == null) {
            ruleId = UUID.randomUUID().toString();
            certMapper.insertRule(ruleId, tenantId, positionId, "custom");
        }
        certMapper.deleteWeightsByRule(ruleId);
        for (var pw : coalescePointWeights(req.getPointWeights())) {
            certMapper.insertWeight(UUID.randomUUID().toString(), ruleId, pw.getAbilityPointId(), null,
                pw.getWeight() == null ? BigDecimal.ZERO : pw.getWeight(), tenantId);
        }
        for (var tw : coalesceTaskWeights(req.getTaskWeights())) {
            certMapper.insertWeight(UUID.randomUUID().toString(), ruleId, tw.getAbilityPointId(), tw.getTaskId(),
                tw.getWeight() == null ? BigDecimal.ZERO : tw.getWeight(), tenantId);
        }
        Map<String, Object> ruleRow = certMapper.findPositionRule(tenantId, positionId);
        return ruleRow == null ? toRuleDto(fetchRule(ruleId)) : ruleFromRow(ruleRow);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, String> putPointLevels(String positionId, String abilityPointId, PutPointLevelsRequest req) {
        String tenantId = requireTenant();
        requireUser();
        checkPositionTenant(tenantId, positionId);
        if (abilityPointId == null || abilityPointId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        List<LevelMappingDto> mapping = coalesceLevels(req.getLevelMapping());
        validateLevelMapping(mapping);
        certMapper.upsertPointLevels(tenantId, positionId, abilityPointId, toJson(mapping));
        Map<String, String> resp = new LinkedHashMap<>();
        resp.put("positionId", positionId);
        resp.put("abilityPointId", abilityPointId);
        return resp;
    }

    /** 组装岗位能力认定模型（对齐 Go LoadModel：关联链 + 两级权重，缺省均分） */
    private List<CertificationModelDomainDto> loadModel(String tenantId, String positionId, String ruleId) {
        List<Map<String, Object>> bindRows = certMapper.loadModelBindings(positionId, tenantId);
        if (bindRows.isEmpty()) {
            return new ArrayList<>();
        }
        List<CertificationModelPointDto> points = new ArrayList<>();
        Map<String, Integer> pointIdx = new LinkedHashMap<>();
        for (Map<String, Object> row : bindRows) {
            String apId = str(row.get("ability_point_id"));
            if (pointIdx.containsKey(apId)) {
                continue;
            }
            CertificationModelPointDto p = new CertificationModelPointDto();
            p.setAbilityPointId(apId);
            p.setName(str(row.get("name")));
            p.setDescription(str(row.get("description")));
            p.setRequiredLevel(str(row.get("required_level")));
            p.setRubricDescription(str(row.get("rubric_description")));
            p.setTasks(new ArrayList<>());
            pointIdx.put(apId, points.size());
            points.add(p);
        }
        // 能力点自定义五档分数线
        Map<String, List<LevelMappingDto>> pointLevels = new LinkedHashMap<>();
        for (Map<String, Object> row : certMapper.listPointLevels(tenantId, positionId)) {
            pointLevels.put(str(row.get("ability_point_id")), parseLevelMappings(str(row.get("level_mapping"))));
        }
        for (CertificationModelPointDto p : points) {
            List<LevelMappingDto> lm = pointLevels.get(p.getAbilityPointId());
            if (lm != null && !lm.isEmpty()) {
                p.setLevelMapping(lm);
            }
        }
        List<String> pointIds = points.stream().map(CertificationModelPointDto::getAbilityPointId).toList();
        // 能力点→关联任务（场景评分点关联链 + scenario_tasks.ability_point_ids 直接关联，去重）
        Set<String> seen = new LinkedHashSet<>();
        Map<String, List<CertificationModelTaskDto>> tasksByPoint = new LinkedHashMap<>();
        for (Map<String, Object> row : certMapper.loadModelTasks(positionId, tenantId, pointIds)) {
            String key = str(row.get("ap_id")) + "|" + str(row.get("task_id")) + "|scene";
            if (seen.add(key)) {
                tasksByPoint.computeIfAbsent(str(row.get("ap_id")), k -> new ArrayList<>()).add(modelTask(row));
            }
        }
        for (Map<String, Object> row : certMapper.loadModelTasksDirect(positionId, pointIds)) {
            String key = str(row.get("ap_id")) + "|" + str(row.get("task_id")) + "|scene";
            if (seen.add(key)) {
                tasksByPoint.computeIfAbsent(str(row.get("ap_id")), k -> new ArrayList<>()).add(modelTask(row));
            }
        }
        for (CertificationModelPointDto p : points) {
            p.setTasks(tasksByPoint.getOrDefault(p.getAbilityPointId(), new ArrayList<>()));
        }
        // 两级权重：certification_weights（task_id 为 NULL 的行是能力点级权重），缺省均分
        Map<String, BigDecimal> stored = new LinkedHashMap<>();
        if (ruleId != null && !ruleId.isEmpty()) {
            for (Map<String, Object> row : certMapper.loadWeights(ruleId)) {
                String key = str(row.get("ability_point_id")) + "|" + (row.get("task_id") == null ? "" : str(row.get("task_id")));
                stored.put(key, decOrNull(row.get("weight")));
            }
        }
        List<BigDecimal> pointDefaults = splitEvenly(new BigDecimal("100"), points.size());
        for (int i = 0; i < points.size(); i++) {
            CertificationModelPointDto p = points.get(i);
            BigDecimal w = stored.get(p.getAbilityPointId() + "|");
            p.setWeight(w != null ? w : pointDefaults.get(i));
            List<BigDecimal> taskDefaults = splitEvenly(new BigDecimal("100"), p.getTasks().size());
            for (int j = 0; j < p.getTasks().size(); j++) {
                CertificationModelTaskDto t = p.getTasks().get(j);
                BigDecimal tw = stored.get(p.getAbilityPointId() + "|" + t.getTaskId());
                t.setWeight(tw != null ? tw : taskDefaults.get(j));
            }
        }
        // 按 domain 分组（保持绑定出现顺序）
        List<CertificationModelDomainDto> domains = new ArrayList<>();
        Map<String, Integer> domainIdx = new LinkedHashMap<>();
        for (int i = 0; i < bindRows.size(); i++) {
            String apId = str(bindRows.get(i).get("ability_point_id"));
            Integer pi = pointIdx.get(apId);
            if (pi == null) {
                continue;
            }
            String domainName = str(bindRows.get(i).get("domain_name"));
            Integer di = domainIdx.get(domainName);
            if (di == null) {
                di = domains.size();
                domainIdx.put(domainName, di);
                CertificationModelDomainDto d = new CertificationModelDomainDto();
                d.setName(domainName);
                d.setPoints(new ArrayList<>());
                domains.add(d);
            }
            domains.get(di).getPoints().add(points.get(pi));
        }
        return domains;
    }

    private CertificationModelTaskDto modelTask(Map<String, Object> row) {
        CertificationModelTaskDto t = new CertificationModelTaskDto();
        t.setTaskId(str(row.get("task_id")));
        t.setTaskName(str(row.get("task_name")));
        t.setScenarioName(str(row.get("scenario_name")));
        t.setTaskType("scene");
        t.setWeight(BigDecimal.ZERO);
        return t;
    }

    /** 把 total 均分为 n 份（两位小数，除不尽的余数补给第一份；对齐 Go splitEvenly） */
    private List<BigDecimal> splitEvenly(BigDecimal total, int n) {
        List<BigDecimal> parts = new ArrayList<>();
        if (n <= 0) {
            return parts;
        }
        BigDecimal base = total.divide(BigDecimal.valueOf(n), 2, RoundingMode.FLOOR);
        for (int i = 0; i < n; i++) {
            parts.add(base);
        }
        BigDecimal first = total.subtract(base.multiply(BigDecimal.valueOf(n - 1L))).setScale(2, RoundingMode.HALF_UP);
        parts.set(0, first);
        return parts;
    }

    /** 校验能力点五档分数线（对齐 Go validateLevelMapping） */
    private void validateLevelMapping(List<LevelMappingDto> mapping) {
        if (mapping.size() != MASTERY_LEVEL_ORDER.size()) {
            throw new ApiException(400, "bad_request", "分档配置不合法：分档配置需恰好 5 档");
        }
        for (int i = 0; i < mapping.size(); i++) {
            LevelMappingDto m = mapping.get(i);
            if (!MASTERY_LEVEL_ORDER.get(i).equals(m.getLevel())) {
                throw new ApiException(400, "bad_request", "分档配置不合法：分档等级必须按 了解/理解/掌握/熟练/精通 顺序排列");
            }
            double min = m.getMin() == null ? 0 : m.getMin();
            double max = m.getMax() == null ? 0 : m.getMax();
            if (Math.floor(min) != min || Math.floor(max) != max) {
                throw new ApiException(400, "bad_request", "分档配置不合法：分档分值必须为整数");
            }
            if (min < 0 || min > 100 || max < 0 || max > 100) {
                throw new ApiException(400, "bad_request", "分档配置不合法：分档分值必须在 0-100 之间");
            }
            if (min >= max) {
                throw new ApiException(400, "bad_request", "分档配置不合法：分档下限必须小于上限");
            }
            if (i > 0) {
                LevelMappingDto prev = mapping.get(i - 1);
                if (min <= (prev.getMin() == null ? 0 : prev.getMin())) {
                    throw new ApiException(400, "bad_request", "分档配置不合法：分档下限必须严格递增");
                }
                if (min - 1 != (prev.getMax() == null ? 0 : prev.getMax())) {
                    throw new ApiException(400, "bad_request", "分档配置不合法：分档区间必须连续（上一档上限 = 本档下限 - 1）");
                }
            }
        }
        if ((mapping.get(0).getMin() == null ? 0 : mapping.get(0).getMin()) < 1) {
            throw new ApiException(400, "bad_request", "分档配置不合法：最低档下限必须大于 0（保留未达标档）");
        }
        if ((mapping.get(mapping.size() - 1).getMax() == null ? 0 : mapping.get(mapping.size() - 1).getMax()) != 100) {
            throw new ApiException(400, "bad_request", "分档配置不合法：最高档上限必须为 100");
        }
    }

    private boolean validateTaskWeights(List<CertificationTaskRequest> tasks) {
        if (tasks.isEmpty()) {
            return true;
        }
        BigDecimal total = BigDecimal.ZERO;
        for (CertificationTaskRequest t : tasks) {
            total = total.add(t.getWeight() == null ? BigDecimal.ZERO : t.getWeight());
        }
        return total.compareTo(new BigDecimal("99.9")) >= 0 && total.compareTo(new BigDecimal("100.1")) <= 0;
    }

    // ==================== 内部 ====================

    private EvaluationCertificationRule fetchRule(String id) {
        String tenantId = requireTenant();
        EvaluationCertificationRule rule = certMapper.selectOne(QueryBuilder.lambda(EvaluationCertificationRule.class)
            .eq(EvaluationCertificationRule::getId, id)
            .eq(EvaluationCertificationRule::getTenantId, tenantId).build());
        if (rule == null) {
            throw new ApiException(404, "not_found", "认证规则不存在");
        }
        return rule;
    }

    private EvaluationCertificationItem fetchItem(String id) {
        String tenantId = requireTenant();
        EvaluationCertificationItem item = itemMapper.selectOne(QueryBuilder.lambda(EvaluationCertificationItem.class)
            .eq(EvaluationCertificationItem::getId, id)
            .eq(EvaluationCertificationItem::getTenantId, tenantId).build());
        if (item == null) {
            throw new ApiException(404, "not_found", "认证项不存在");
        }
        return item;
    }

    private EvaluationCertificationPoint fetchPoint(String id) {
        String tenantId = requireTenant();
        EvaluationCertificationPoint point = pointMapper.selectOne(QueryBuilder.lambda(EvaluationCertificationPoint.class)
            .eq(EvaluationCertificationPoint::getId, id)
            .eq(EvaluationCertificationPoint::getTenantId, tenantId).build());
        if (point == null) {
            throw new ApiException(404, "not_found", "认证点不存在");
        }
        return point;
    }

    private EvaluationCertificationTask fetchTask(String id) {
        String tenantId = requireTenant();
        EvaluationCertificationTask task = taskMapper.selectOne(QueryBuilder.lambda(EvaluationCertificationTask.class)
            .eq(EvaluationCertificationTask::getId, id)
            .eq(EvaluationCertificationTask::getTenantId, tenantId).build());
        if (task == null) {
            throw new ApiException(404, "not_found", "关联任务不存在");
        }
        return task;
    }

    private void checkPositionTenant(String tenantId, String positionId) {
        String posTenant = certMapper.positionTenantId(positionId);
        if (posTenant == null || !posTenant.equals(tenantId)) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
    }

    private CertificationRuleDto toRuleDto(EvaluationCertificationRule r) {
        CertificationRuleDto dto = new CertificationRuleDto();
        dto.setId(r.getId());
        dto.setCareerPositionId(r.getCareerPositionId());
        dto.setStatus(r.getStatus());
        dto.setRuleSource(r.getRuleSource());
        dto.setLevelMapping(parseLevelMappings(r.getLevelMapping()));
        dto.setCreatedAt(r.getCreatedAt());
        dto.setUpdatedAt(r.getUpdatedAt());
        return dto;
    }

    private CertificationRuleDto ruleFromRow(Map<String, Object> row) {
        CertificationRuleDto dto = new CertificationRuleDto();
        dto.setId(str(row.get("id")));
        dto.setCareerPositionId(str(row.get("career_position_id")));
        dto.setStatus(str(row.get("status")));
        dto.setRuleSource(str(row.get("rule_source")));
        dto.setLevelMapping(parseLevelMappings(str(row.get("level_mapping"))));
        dto.setCreatedAt(odt(row.get("created_at")));
        dto.setUpdatedAt(odt(row.get("updated_at")));
        return dto;
    }

    private CertificationAbilityItemDto toItemDto(EvaluationCertificationItem i) {
        CertificationAbilityItemDto dto = new CertificationAbilityItemDto();
        dto.setId(i.getId());
        dto.setRuleId(i.getRuleId());
        dto.setName(i.getName());
        dto.setSortOrder(i.getSortOrder());
        return dto;
    }

    private CertificationAbilityPointDto toPointDto(EvaluationCertificationPoint p) {
        CertificationAbilityPointDto dto = new CertificationAbilityPointDto();
        dto.setId(p.getId());
        dto.setItemId(p.getItemId());
        dto.setAbilityPointId(p.getAbilityPointId());
        dto.setMappingType(p.getMappingType());
        dto.setCustomLevelMapping(parseLevelMappings(p.getCustomLevelMapping()));
        dto.setRequiredLevel(p.getRequiredLevel());
        dto.setWeight(p.getWeight());
        return dto;
    }

    private CertificationRelatedTaskDto toTaskDto(EvaluationCertificationTask t) {
        CertificationRelatedTaskDto dto = new CertificationRelatedTaskDto();
        dto.setId(t.getId());
        dto.setCertPointId(t.getCertPointId());
        dto.setTaskId(t.getTaskId());
        dto.setMaxScore(t.getMaxScore());
        dto.setWeight(t.getWeight());
        return dto;
    }

    List<LevelMappingDto> parseLevelMappings(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<LevelMappingDto> v = MAPPER.readValue(json, LEVEL_MAPPING_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private List<LevelMappingDto> coalesceLevels(List<LevelMappingDto> list) {
        return list == null ? List.of() : list;
    }

    private List<PutFullCertificationItemRequest> coalesceItems(List<PutFullCertificationItemRequest> list) {
        return list == null ? List.of() : list;
    }

    private List<PutFullCertificationPointRequest> coalescePoints(List<PutFullCertificationPointRequest> list) {
        return list == null ? List.of() : list;
    }

    private List<CertificationTaskRequest> coalesceTasks(List<CertificationTaskRequest> list) {
        return list == null ? List.of() : list;
    }

    private List<org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationPointWeightDto> coalescePointWeights(
        List<org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationPointWeightDto> list) {
        return list == null ? List.of() : list;
    }

    private List<org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationTaskWeightDto> coalesceTaskWeights(
        List<org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationTaskWeightDto> list) {
        return list == null ? List.of() : list;
    }

    String toJson(Object v) {
        try {
            return MAPPER.writeValueAsString(v);
        } catch (Exception e) {
            return "[]";
        }
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

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
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

    private java.time.OffsetDateTime odt(Object o) {
        return o instanceof java.time.OffsetDateTime odt ? odt : null;
    }
}
