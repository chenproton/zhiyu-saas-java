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
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BindResourceRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CreateTaskResourceRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskResourceDto;
import org.dromara.zhiyu.domain.library.LibraryResource;
import org.dromara.zhiyu.domain.scene.SceneTaskResourceBinding;
import org.dromara.zhiyu.mapper.library.LibraryResourceMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioTaskMapper;
import org.dromara.zhiyu.mapper.scene.SceneTaskResourceBindingMapper;
import org.dromara.zhiyu.service.scene.ISceneTaskResourceService;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 任务资源服务实现（对齐 Go task_resource_handler.go + service/resource_binding.go +
 * store/resource_bindings.go 语义）。
 *
 * <p>资源实体为 resource_library 表（非 task_resources 表）；绑定表为
 * task_resource_bindings（resource_id → resource_library.id）。</p>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class SceneTaskResourceServiceImpl implements ISceneTaskResourceService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    private final LibraryResourceMapper resourceMapper;
    private final SceneTaskResourceBindingMapper bindingMapper;
    private final SceneScenarioTaskMapper taskMapper;
    private final SceneScenarioMapper scenarioMapper;

    @Override
    public ListResponse<TaskResourceDto> list(String taskId, String search, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        // 按绑定过滤（对齐 Go JOIN task_resource_bindings）
        List<String> boundResourceIds = null;
        if (taskId != null && !taskId.isEmpty()) {
            List<SceneTaskResourceBinding> binds = bindingMapper.selectList(
                QueryBuilder.lambda(SceneTaskResourceBinding.class).eq(SceneTaskResourceBinding::getTaskId, taskId).build());
            boundResourceIds = binds.stream().map(SceneTaskResourceBinding::getResourceId).toList();
            if (boundResourceIds.isEmpty()) {
                return ListResponse.of(new ArrayList<>(), 0);
            }
        }

        LambdaQueryBuilder<LibraryResource> wrapper = QueryBuilder.lambda(LibraryResource.class)
            .eq(LibraryResource::getTenantId, tenantId);
        if (search != null && !search.isEmpty()) {
            wrapper.and(w -> w.like(LibraryResource::getName, search).or().like(LibraryResource::getDescription, search));
        }
        if (boundResourceIds != null) {
            wrapper.in(LibraryResource::getId, boundResourceIds);
        }
        long total = resourceMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(LibraryResource::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<LibraryResource> rows = resourceMapper.selectList(wrapper.build());
        List<TaskResourceDto> items = new ArrayList<>(rows.size());
        for (LibraryResource r : rows) {
            items.add(toTaskResource(r));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public TaskResourceDto create(CreateTaskResourceRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (req.getName() == null || req.getName().isEmpty()
            || req.getType() == null || req.getType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // metadata = extraData + knowledgePointIds（对齐 Go metadata 组装）
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (req.getExtraData() != null) {
            metadata.putAll(req.getExtraData());
        }
        metadata.put("knowledgePointIds", req.getKnowledgePointIds() == null ? List.of() : req.getKnowledgePointIds());

        Long fileSize = null;
        if (req.getSize() != null && !req.getSize().isEmpty()) {
            try {
                fileSize = Long.parseLong(req.getSize());
            } catch (NumberFormatException ignored) {
                fileSize = null;
            }
        }

        String id = UUID.randomUUID().toString();
        resourceMapper.insertResource(id, tenantId, req.getName(), req.getType(), req.getUrl(),
            req.getDescription(), req.getThumbnail(), fileSize, toJson(metadata), userId);
        LibraryResource created = resourceMapper.selectItemById(id);
        if (created == null) {
            throw new ApiException(500, "internal_error", "创建资源失败");
        }
        return toTaskResource(created);
    }

    @Override
    public String bind(BindResourceRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getTaskId() == null || req.getTaskId().isEmpty()
            || req.getResourceId() == null || req.getResourceId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        checkTaskTenant(req.getTaskId());
        String id = bindingMapper.bindReturnId(tenantId, req.getTaskId(), req.getResourceId());
        if (id == null) {
            throw new ApiException(500, "internal_error", "绑定资源失败");
        }
        return id;
    }

    @Override
    public String unbind(String id) {
        requireUser();
        // 绑定不存在时静默成功（对齐 Go Unbind 幂等语义）
        String taskId = bindingMapper.selectTaskId(id);
        if (taskId == null) {
            return id;
        }
        checkTaskTenant(taskId);
        bindingMapper.unbind(id);
        return id;
    }

    /**
     * 校验任务所属场景的租户归属（task→scenario→tenant 链路；Bind/Unbind 共用）。
     */
    private void checkTaskTenant(String taskId) {
        String scenarioId = taskMapper.selectScenarioId(taskId);
        if (scenarioId == null) {
            throw new ApiException(404, "not_found", "任务不存在");
        }
        String scenarioTenantId = scenarioMapper.selectTenantId(scenarioId);
        if (scenarioTenantId == null) {
            throw new ApiException(404, "not_found", "场景不存在");
        }
        verifyTenantOwnership(scenarioTenantId);
    }

    // ---------- 工具 ----------

    /** 资源行 → TaskResource（size 为 file_size 文本；knowledgePointIds 来自 metadata）。 */
    private TaskResourceDto toTaskResource(LibraryResource r) {
        TaskResourceDto dto = new TaskResourceDto();
        dto.setId(r.getId());
        dto.setName(r.getName());
        dto.setType(r.getResourceType());
        dto.setUrl(r.getUrl());
        dto.setDescription(r.getDescription());
        dto.setThumbnail(r.getThumbnail());
        dto.setSize(r.getFileSize() == null ? "" : String.valueOf(r.getFileSize()));
        dto.setKnowledgePointIds(parseKnowledgePointIds(r.getMetadata()));
        dto.setUploadedBy(r.getUploadedBy());
        dto.setUploadedAt(r.getCreatedAt());
        return dto;
    }

    private List<String> parseKnowledgePointIds(String metadata) {
        if (metadata == null || metadata.isBlank()) {
            return null;
        }
        try {
            Map<String, Object> m = MAPPER.readValue(metadata, MAP_REF);
            Object raw = m.get("knowledgePointIds");
            if (raw == null) {
                return null;
            }
            return MAPPER.convertValue(raw, STRING_LIST_REF);
        } catch (Exception e) {
            return null;
        }
    }

    private String toJson(Map<String, Object> map) {
        try {
            return MAPPER.writeValueAsString(map == null ? Map.of() : map);
        } catch (Exception e) {
            return "{}";
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

    private void verifyTenantOwnership(String entityTenantId) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (entityTenantId != null && !entityTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
    }

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }
}
