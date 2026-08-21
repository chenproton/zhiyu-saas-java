package org.dromara.zhiyu.service.impl.lesson;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchSaveHybridModulesRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.HybridNodeModuleDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.UpsertHybridModuleRequest;
import org.dromara.zhiyu.domain.lesson.HybridNodeModule;
import org.dromara.zhiyu.mapper.lesson.HybridNodeModuleMapper;
import org.dromara.zhiyu.mapper.lesson.SystemCourseNodeMapper;
import org.dromara.zhiyu.service.lesson.ILessonHybridModuleService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 混合模块服务实现（对齐 Go hybrid_module_handler.go + store/hybrid_modules.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LessonHybridModuleServiceImpl implements ILessonHybridModuleService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    private final HybridNodeModuleMapper hybridMapper;
    private final SystemCourseNodeMapper nodeMapper;

    @Override
    public ListResponse<HybridNodeModuleDto> list(String nodeId, String courseId) {
        String tenantId = requireTenant();
        List<HybridNodeModule> rows = hybridMapper.selectModules(tenantId, nodeId, courseId);
        List<HybridNodeModuleDto> items = rows.stream().map(this::toDto).toList();
        return ListResponse.of(items, items.size());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String batchSave(BatchSaveHybridModulesRequest req) {
        requireUser();
        String tenantId = requireTenant();
        if (req.getNodeId() == null || req.getNodeId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String nodeTenantId = nodeMapper.selectTenantId(req.getNodeId());
        if (nodeTenantId == null || !nodeTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "课程节点不存在");
        }
        hybridMapper.deleteByNode(req.getNodeId(), tenantId);
        if (req.getModules() != null) {
            for (var m : req.getModules()) {
                if (m.getModuleKey() == null || m.getModuleKey().isEmpty()) {
                    continue;
                }
                hybridMapper.insertModule(tenantId, req.getNodeId(), m.getModuleKey(), m.getMode(),
                    toJson(m.getData()));
            }
        }
        return req.getNodeId();
    }

    @Override
    public HybridNodeModuleDto upsert(UpsertHybridModuleRequest req, String urlId) {
        requireUser();
        String tenantId = requireTenant();
        if (req.getNodeId() == null || req.getNodeId().isEmpty() || req.getModuleKey() == null
            || req.getModuleKey().isEmpty() || req.getMode() == null || req.getMode().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (urlId != null && !urlId.isEmpty()) {
            req.setId(urlId);
        }
        String nodeTenantId = nodeMapper.selectTenantId(req.getNodeId());
        if (nodeTenantId == null || !nodeTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "课程节点不存在");
        }
        String id;
        if (req.getId() != null && !req.getId().isEmpty()) {
            if (hybridMapper.selectModule(req.getId(), tenantId) == null) {
                throw new ApiException(404, "not_found", "混合模块不存在");
            }
            hybridMapper.updateModule(req.getId(), tenantId, req.getNodeId(), req.getModuleKey(),
                req.getMode(), toJson(req.getData()));
            id = req.getId();
        } else {
            id = UUID.randomUUID().toString();
            hybridMapper.insertModuleReturnId(id, tenantId, req.getNodeId(), req.getModuleKey(),
                req.getMode(), toJson(req.getData()));
        }
        HybridNodeModule saved = hybridMapper.selectModule(id, tenantId);
        if (saved == null) {
            throw new ApiException(500, "internal_error", "保存混合模块失败");
        }
        return toDto(saved);
    }

    @Override
    public String delete(String id) {
        requireUser();
        String tenantId = requireTenant();
        if (hybridMapper.selectModule(id, tenantId) == null) {
            throw new ApiException(404, "not_found", "混合模块不存在");
        }
        hybridMapper.deleteModule(id, tenantId);
        return id;
    }

    private HybridNodeModuleDto toDto(HybridNodeModule m) {
        HybridNodeModuleDto dto = new HybridNodeModuleDto();
        dto.setId(m.getId());
        dto.setNodeId(m.getNodeId());
        dto.setModuleKey(m.getModuleKey());
        dto.setMode(m.getMode());
        dto.setData(fromJson(m.getData()));
        return dto;
    }

    private String toJson(Map<String, Object> map) {
        try {
            return MAPPER.writeValueAsString(map == null ? Map.of() : map);
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "模块数据格式不正确");
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
}
