package org.dromara.zhiyu.service.impl.lesson;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateNodeRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeEnrichResourceDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeKnowledgePointDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeQuizDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.ReorderNodesRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.SystemCourseNodeDto;
import org.dromara.zhiyu.domain.lesson.KnowledgePoint;
import org.dromara.zhiyu.domain.lesson.SystemCourseNode;
import org.dromara.zhiyu.mapper.lesson.KnowledgePointMapper;
import org.dromara.zhiyu.mapper.lesson.LessonResourceMapper;
import org.dromara.zhiyu.mapper.lesson.SystemCourseNodeMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.lesson.ILessonNodeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 体系课节点服务实现（对齐 Go course_node_handler.go + store/course_nodes.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LessonNodeServiceImpl implements ILessonNodeService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    private final SystemGuard systemGuard;
    private final SystemCourseNodeMapper nodeMapper;
    private final KnowledgePointMapper knowledgePointMapper;
    private final LessonResourceMapper resourceMapper;
    private final LessonCourseMapper courseMapper;

    @Override
    public ListResponse<SystemCourseNodeDto> list(String courseId, String parentId, String rootOnly) {
        String tenantId = systemGuard.requireTenant();
        LambdaQueryBuilder<SystemCourseNode> wrapper = QueryBuilder.lambda(SystemCourseNode.class)
            .eq(SystemCourseNode::getTenantId, tenantId);
        if (courseId != null && !courseId.isEmpty()) {
            wrapper.eq(SystemCourseNode::getCourseId, courseId);
        }
        if (parentId != null && !parentId.isEmpty()) {
            wrapper.eq(SystemCourseNode::getParentId, parentId);
        } else if ("true".equals(rootOnly)) {
            wrapper.isNull(SystemCourseNode::getParentId);
        }
        wrapper.orderByAsc(SystemCourseNode::getSortOrder).orderByAsc(SystemCourseNode::getId);
        List<SystemCourseNode> rows = nodeMapper.selectList(wrapper.build());
        List<SystemCourseNodeDto> items = enrich(rows);
        return ListResponse.of(items, items.size());
    }

    @Override
    public SystemCourseNodeDto get(String id) {
        systemGuard.requireUser();
        return enrich(List.of(fetchOwned(id))).get(0);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SystemCourseNodeDto create(CreateNodeRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        if (req.getCourseId() == null || req.getCourseId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        requireCourseInTenant(req.getCourseId(), tenantId);
        List<String> kpIds = coalesce(req.getKnowledgePointIds());
        List<String> resIds = coalesce(req.getResourceIds());
        checkRefsTenant(tenantId, kpIds, resIds, req.getSourceId(), req.getRefType());

        String id = UUID.randomUUID().toString();
        nodeMapper.insertNode(id, tenantId, req.getCourseId(), emptyToNull(req.getParentId()), req.getName(),
            req.getCode(), req.getSortOrder() == null ? 0 : req.getSortOrder(),
            req.getRefType() == null || req.getRefType().isEmpty() ? "normal" : req.getRefType(),
            emptyToNull(req.getSourceId()), req.getSourceName(), req.getTeachingGoals(), req.getDetailedDescription(),
            req.getDescriptionPdf(), req.getBackground(), req.getEstimatedHours(), req.getDuration(), req.getDifficulty(),
            kpIds, resIds, toJson(req.getEvalData()), req.getStatus() == null || req.getStatus().isEmpty() ? ZhiyuStatusConstants.DRAFT : req.getStatus());
        for (String kpId : kpIds) {
            nodeMapper.insertNodeKnowledgeBinding(id, kpId);
        }
        for (String resId : resIds) {
            nodeMapper.insertNodeResourceBinding(id, resId);
        }
        return enrich(List.of(fetchOwned(id))).get(0);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SystemCourseNodeDto update(String id, CreateNodeRequest req) {
        systemGuard.requireUser();
        SystemCourseNode existing = fetchOwned(id);
        String tenantId = existing.getTenantId();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String parentId = req.getParentId() != null ? emptyToNull(req.getParentId()) : existing.getParentId();
        String code = req.getCode() != null ? req.getCode() : existing.getCode();
        int sortOrder = req.getSortOrder() == null || req.getSortOrder() == 0 ? existing.getSortOrder() : req.getSortOrder();
        String refType = req.getRefType() == null || req.getRefType().isEmpty() ? existing.getRefType() : req.getRefType();
        String sourceId = req.getSourceId() != null ? emptyToNull(req.getSourceId()) : existing.getSourceId();
        String sourceName = req.getSourceName() != null ? req.getSourceName() : existing.getSourceName();
        String teachingGoals = req.getTeachingGoals() != null ? req.getTeachingGoals() : existing.getTeachingGoals();
        String detailedDescription = req.getDetailedDescription() != null ? req.getDetailedDescription() : existing.getDetailedDescription();
        String descriptionPdf = req.getDescriptionPdf() != null ? req.getDescriptionPdf() : existing.getDescriptionPdf();
        String background = req.getBackground() != null ? req.getBackground() : existing.getBackground();
        var estimatedHours = req.getEstimatedHours() != null ? req.getEstimatedHours() : existing.getEstimatedHours();
        Integer duration = req.getDuration() != null ? req.getDuration() : existing.getDuration();
        Integer difficulty = req.getDifficulty() != null ? req.getDifficulty() : existing.getDifficulty();
        String evalData = req.getEvalData() != null ? toJson(req.getEvalData()) : existing.getEvalData();
        String status = req.getStatus() == null || req.getStatus().isEmpty() ? existing.getStatus() : req.getStatus();

        List<String> kpIds = req.getKnowledgePointIds() != null ? req.getKnowledgePointIds() : existing.getKnowledgePointIds();
        List<String> resIds = req.getResourceIds() != null ? req.getResourceIds() : existing.getResourceIds();
        if ("original".equals(refType)) {
            kpIds = List.of();
            resIds = List.of();
        }
        checkRefsTenant(tenantId, kpIds, resIds, sourceId, refType);

        nodeMapper.updateNode(id, tenantId, req.getName(), code, sortOrder, refType, sourceId, sourceName,
            teachingGoals, detailedDescription, descriptionPdf, background, estimatedHours, duration, difficulty,
            kpIds, resIds, evalData, status);
        nodeMapper.deleteNodeKnowledgeBindings(id);
        nodeMapper.deleteNodeResourceBindings(id);
        for (String kpId : kpIds) {
            nodeMapper.insertNodeKnowledgeBinding(id, kpId);
        }
        for (String resId : resIds) {
            nodeMapper.insertNodeResourceBinding(id, resId);
        }
        return enrich(List.of(fetchOwned(id))).get(0);
    }

    @Override
    public String delete(String id) {
        systemGuard.requireUser();
        SystemCourseNode existing = fetchOwned(id);
        if (nodeMapper.existsEvaluationResults(id)) {
            throw new ApiException(409, "conflict", "该节点已存在测评成绩，无法删除");
        }
        nodeMapper.deleteNode(id, existing.getTenantId());
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean reorder(ReorderNodesRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        if (req.getCourseId() == null || req.getCourseId().isEmpty()
            || req.getNodeIds() == null || req.getNodeIds().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        requireCourseInTenant(req.getCourseId(), tenantId);
        int order = 0;
        for (String nodeId : req.getNodeIds()) {
            nodeMapper.reorderNode(nodeId, req.getCourseId(), order++);
        }
        return true;
    }

    // ---------- 富化 ----------

    private List<SystemCourseNodeDto> enrich(List<SystemCourseNode> rows) {
        List<SystemCourseNodeDto> items = new ArrayList<>(rows.size());
        if (rows.isEmpty()) {
            return items;
        }
        List<String> nodeIds = new ArrayList<>(rows.size());
        Set<String> kpIdSet = new LinkedHashSet<>();
        Set<String> resIdSet = new LinkedHashSet<>();
        Set<String> originalSourceIds = new LinkedHashSet<>();
        Map<String, String> nodeBySource = new LinkedHashMap<>();
        for (SystemCourseNode n : rows) {
            items.add(toDto(n));
            nodeIds.add(n.getId());
            if (n.getKnowledgePointIds() != null) {
                kpIdSet.addAll(n.getKnowledgePointIds());
            }
            if (n.getResourceIds() != null) {
                resIdSet.addAll(n.getResourceIds());
            }
            if ("original".equals(n.getRefType()) && n.getSourceId() != null && !n.getSourceId().isEmpty()) {
                originalSourceIds.add(n.getSourceId());
                nodeBySource.put(n.getSourceId(), n.getId());
            }
        }

        Map<String, NodeKnowledgePointDto> kpMap = new LinkedHashMap<>();
        if (!kpIdSet.isEmpty()) {
            for (NodeKnowledgePointDto kp : nodeMapper.selectKnowledgePointsByIds(new ArrayList<>(kpIdSet))) {
                kpMap.put(kp.getId(), kp);
            }
        }
        Map<String, NodeEnrichResourceDto> resMap = new LinkedHashMap<>();
        if (!resIdSet.isEmpty()) {
            for (NodeEnrichResourceDto r : nodeMapper.selectResourcesByIds(new ArrayList<>(resIdSet))) {
                resMap.put(r.getId(), r);
            }
        }
        Map<String, List<NodeQuizDto>> quizMap = new LinkedHashMap<>();
        for (NodeQuizDto q : nodeMapper.selectQuizzesByNodeIds(nodeIds)) {
            quizMap.computeIfAbsent(q.getNodeId(), k -> new ArrayList<>()).add(q);
        }
        Map<String, List<SystemCourseNodeMapper.OriginalKpRow>> origKpMap = new LinkedHashMap<>();
        if (!originalSourceIds.isEmpty()) {
            for (SystemCourseNodeMapper.OriginalKpRow r : nodeMapper.selectOriginalSourceKnowledgePoints(new ArrayList<>(originalSourceIds))) {
                origKpMap.computeIfAbsent(r.getCourseId(), k -> new ArrayList<>()).add(r);
            }
        }
        Map<String, List<SystemCourseNodeMapper.OriginalResRow>> origResMap = new LinkedHashMap<>();
        if (!originalSourceIds.isEmpty()) {
            for (SystemCourseNodeMapper.OriginalResRow r : nodeMapper.selectOriginalSourceResources(new ArrayList<>(originalSourceIds))) {
                origResMap.computeIfAbsent(r.getCourseId(), k -> new ArrayList<>()).add(r);
            }
        }

        for (int i = 0; i < rows.size(); i++) {
            SystemCourseNode n = rows.get(i);
            SystemCourseNodeDto dto = items.get(i);
            if (n.getKnowledgePointIds() != null) {
                for (String kpId : n.getKnowledgePointIds()) {
                    NodeKnowledgePointDto kp = kpMap.get(kpId);
                    if (kp != null) {
                        dto.getKnowledgePoints().add(kp);
                    }
                }
            }
            if (n.getResourceIds() != null) {
                for (String resId : n.getResourceIds()) {
                    NodeEnrichResourceDto r = resMap.get(resId);
                    if (r != null) {
                        dto.getResources().add(r);
                    }
                }
            }
            List<NodeQuizDto> quizzes = quizMap.get(n.getId());
            if (quizzes != null) {
                dto.setQuizzes(quizzes);
            }
            // original 节点从来源颗粒课继承知识点/资源
            if ("original".equals(n.getRefType()) && n.getSourceId() != null) {
                Set<String> kpSeen = new LinkedHashSet<>(n.getKnowledgePointIds() == null ? List.of() : n.getKnowledgePointIds());
                Set<String> resSeen = new LinkedHashSet<>(n.getResourceIds() == null ? List.of() : n.getResourceIds());
                for (SystemCourseNodeMapper.OriginalKpRow r : origKpMap.getOrDefault(n.getSourceId(), List.of())) {
                    if (kpSeen.add(r.getId())) {
                        dto.getKnowledgePoints().add(toKpDto(r));
                    }
                }
                for (SystemCourseNodeMapper.OriginalResRow r : origResMap.getOrDefault(n.getSourceId(), List.of())) {
                    if (resSeen.add(r.getId())) {
                        dto.getResources().add(toResDto(r));
                    }
                }
            }
        }
        return items;
    }

    private SystemCourseNodeDto toDto(SystemCourseNode n) {
        SystemCourseNodeDto dto = new SystemCourseNodeDto();
        dto.setId(n.getId());
        dto.setCourseId(n.getCourseId());
        dto.setParentId(n.getParentId());
        dto.setName(n.getName());
        dto.setCode(n.getCode());
        dto.setOrder(n.getSortOrder());
        dto.setType(n.getRefType());
        dto.setSourceId(n.getSourceId());
        dto.setSourceName(n.getSourceName());
        dto.setTeachingGoals(n.getTeachingGoals());
        dto.setDetailedDescription(n.getDetailedDescription());
        dto.setDescriptionPdf(n.getDescriptionPdf());
        dto.setBackground(n.getBackground());
        dto.setEstimatedHours(n.getEstimatedHours());
        dto.setDuration(n.getDuration());
        dto.setDifficulty(n.getDifficulty());
        dto.setEvalData(fromJson(n.getEvalData()));
        dto.setStatus(n.getStatus());
        dto.setKnowledgePoints(new ArrayList<>());
        dto.setResources(new ArrayList<>());
        dto.setQuizzes(new ArrayList<>());
        dto.setCreatedAt(n.getCreatedAt());
        dto.setUpdatedAt(n.getUpdatedAt());
        return dto;
    }

    private NodeKnowledgePointDto toKpDto(SystemCourseNodeMapper.OriginalKpRow r) {
        NodeKnowledgePointDto dto = new NodeKnowledgePointDto();
        dto.setId(r.getId());
        dto.setName(r.getName());
        dto.setCode(r.getCode());
        dto.setDescription(r.getDescription());
        dto.setLinked(r.getLinked());
        return dto;
    }

    private NodeEnrichResourceDto toResDto(SystemCourseNodeMapper.OriginalResRow r) {
        NodeEnrichResourceDto dto = new NodeEnrichResourceDto();
        dto.setId(r.getId());
        dto.setName(r.getName());
        dto.setType(r.getType());
        dto.setUrl(r.getUrl());
        dto.setSize(r.getSize());
        return dto;
    }

    // ---------- 校验/工具 ----------

    private void requireCourseInTenant(String courseId, String tenantId) {
        String courseTenantId = courseMapper.selectTenantId(courseId);
        if (courseTenantId == null || !courseTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "课程不存在");
        }
    }

    private void checkRefsTenant(String tenantId, List<String> kpIds, List<String> resIds,
                                 String sourceId, String refType) {
        if (!kpIds.isEmpty()) {
            long found = knowledgePointMapper.selectCount(QueryBuilder.lambda(KnowledgePoint.class)
                .eq(KnowledgePoint::getTenantId, tenantId).in(KnowledgePoint::getId, kpIds).build());
            if (found != kpIds.size()) {
                throw new ApiException(404, "not_found", "知识点不存在");
            }
        }
        if (!resIds.isEmpty()) {
            if (resourceMapper.countResourcesInTenant(tenantId, resIds) != resIds.size()) {
                throw new ApiException(404, "not_found", "资源不存在");
            }
        }
        if ("original".equals(refType) && sourceId != null && !sourceId.isEmpty()) {
            String courseTenantId = courseMapper.selectTenantId(sourceId);
            if (courseTenantId == null || !courseTenantId.equals(tenantId)) {
                throw new ApiException(404, "not_found", "引用颗粒课不存在");
            }
        }
    }

    private SystemCourseNode fetchOwned(String id) {
        SystemCourseNode node = nodeMapper.selectById(id);
        if (node == null) {
            throw new ApiException(404, "not_found", "课程节点不存在");
        }
        verifyTenantOwnership(node.getTenantId());
        return node;
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

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }

    private String toJson(Map<String, Object> map) {
        try {
            return MAPPER.writeValueAsString(map == null ? Map.of() : map);
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "评估数据格式不正确");
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
}
