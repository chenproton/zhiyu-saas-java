package org.dromara.zhiyu.service.impl.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.GradeMappingDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.GradeMappingRequest;
import org.dromara.zhiyu.domain.scene.SceneGradeMapping;
import org.dromara.zhiyu.mapper.scene.SceneGradeMappingMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioMapper;
import org.dromara.zhiyu.service.scene.ISceneGradeMappingService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 场景等级映射服务实现（对齐 Go scenario_grade_handler.go + store/scenario_configs.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SceneGradeMappingServiceImpl implements ISceneGradeMappingService {

    private final SceneGradeMappingMapper gradeMapper;
    private final SceneScenarioMapper scenarioMapper;

    @Override
    public ListResponse<GradeMappingDto> list(String scenarioId, String taskId, long limit, long offset) {
        String tenantId = requireTenant();
        requireUser();
        List<SceneGradeMapping> rows = gradeMapper.selectMappings(tenantId, scenarioId, taskId);
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        long total = rows.size();
        int from = (int) Math.min(safeOffset, rows.size());
        int to = (int) Math.min(safeOffset + safeLimit, rows.size());
        List<GradeMappingDto> items = rows.subList(from, to).stream().map(this::toDto).toList();
        return ListResponse.of(items, total);
    }

    @Override
    public GradeMappingDto upsert(GradeMappingRequest req, String urlId) {
        String tenantId = requireTenant();
        requireUser();
        if (isBlank(req.getScenarioId()) || isBlank(req.getLevel())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (urlId != null && !urlId.isEmpty()) {
            req.setId(urlId);
        }
        verifyScenarioTenant(req.getScenarioId());
        if (req.getId() != null && !req.getId().isEmpty()) {
            String existingScenarioId = gradeMapper.selectScenarioId(req.getId());
            if (existingScenarioId == null) {
                throw new ApiException(404, "not_found", "等级映射不存在");
            }
            verifyScenarioTenant(existingScenarioId);
        }

        String id;
        if (req.getId() != null && !req.getId().isEmpty()) {
            gradeMapper.updateMapping(req.getId(), req.getScenarioId(), req.getTaskId(), req.getLevel(),
                req.getMinScore(), req.getMaxScore(), req.getDescription(), req.getColor());
            id = req.getId();
        } else {
            id = UUID.randomUUID().toString();
            gradeMapper.insertMapping(id, tenantId, req.getScenarioId(), req.getTaskId(), req.getLevel(),
                req.getMinScore(), req.getMaxScore(), req.getDescription(), req.getColor());
        }
        SceneGradeMapping saved = gradeMapper.selectById(id);
        if (saved == null) {
            throw new ApiException(500, "internal_error", "更新或创建成绩映射失败");
        }
        return toDto(saved);
    }

    @Override
    public String delete(String id) {
        String tenantId = requireTenant();
        requireUser();
        String scenarioId = gradeMapper.selectScenarioId(id);
        if (scenarioId == null) {
            throw new ApiException(404, "not_found", "等级映射不存在");
        }
        verifyScenarioTenant(scenarioId);
        gradeMapper.deleteMapping(id, tenantId);
        return id;
    }

    private void verifyScenarioTenant(String scenarioId) {
        String scenarioTenantId = scenarioMapper.selectTenantId(scenarioId);
        if (scenarioTenantId == null) {
            throw new ApiException(404, "not_found", "场景不存在");
        }
        verifyTenantOwnership(scenarioTenantId);
    }

    private GradeMappingDto toDto(SceneGradeMapping m) {
        GradeMappingDto dto = new GradeMappingDto();
        dto.setId(m.getId());
        dto.setScenarioId(m.getScenarioId());
        dto.setTaskId(m.getTaskId());
        dto.setLevel(m.getLevel());
        dto.setMinScore(m.getMinScore());
        dto.setMaxScore(m.getMaxScore());
        dto.setDescription(m.getDescription());
        dto.setColor(m.getColor());
        return dto;
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

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
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
}
