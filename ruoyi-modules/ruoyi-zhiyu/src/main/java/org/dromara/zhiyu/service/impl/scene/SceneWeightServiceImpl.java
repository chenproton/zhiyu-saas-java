package org.dromara.zhiyu.service.impl.scene;

import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.WeightDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.WeightRequest;
import org.dromara.zhiyu.domain.scene.SceneWeightConfig;
import org.dromara.zhiyu.mapper.scene.SceneScenarioMapper;
import org.dromara.zhiyu.mapper.scene.SceneWeightConfigMapper;
import org.dromara.zhiyu.service.scene.ISceneWeightService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 场景权重配置服务实现（对齐 Go scenario_weight_handler.go +
 * store/scenario_configs.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SceneWeightServiceImpl implements ISceneWeightService {

    private final SceneWeightConfigMapper weightMapper;
    private final SceneScenarioMapper scenarioMapper;

    @Override
    public ListResponse<WeightDto> list(String scenarioId, String taskId, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        LambdaQueryBuilder<SceneWeightConfig> wrapper = QueryBuilder.lambda(SceneWeightConfig.class)
            .eq(SceneWeightConfig::getTenantId, tenantId)
            .eqIfText(SceneWeightConfig::getScenarioId, scenarioId)
            .eqIfText(SceneWeightConfig::getTaskId, taskId);
        long total = weightMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(SceneWeightConfig::getId).last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<SceneWeightConfig> rows = weightMapper.selectList(wrapper.build());
        List<WeightDto> items = new ArrayList<>(rows.size());
        for (SceneWeightConfig w : rows) {
            WeightDto dto = new WeightDto();
            dto.setId(w.getId());
            dto.setScenarioId(w.getScenarioId());
            dto.setTaskId(w.getTaskId());
            dto.setWeight(w.getWeight());
            items.add(dto);
        }
        return ListResponse.of(items, total);
    }

    @Override
    public WeightDto upsert(WeightRequest req, String urlId) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getScenarioId() == null || req.getScenarioId().isEmpty()
            || req.getTaskId() == null || req.getTaskId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (urlId != null && !urlId.isEmpty()) {
            req.setId(urlId);
        }
        // 场景归属校验
        String scenarioTenantId = scenarioMapper.selectTenantId(req.getScenarioId());
        if (scenarioTenantId == null) {
            throw new ApiException(404, "not_found", "场景不存在");
        }
        verifyTenantOwnership(scenarioTenantId);
        // 已有配置（带 id 时）归属校验
        if (req.getId() != null && !req.getId().isEmpty()) {
            String existingScenarioId = weightMapper.selectScenarioId(req.getId());
            if (existingScenarioId == null) {
                throw new ApiException(404, "not_found", "权重配置不存在");
            }
            String existingTenantId = scenarioMapper.selectTenantId(existingScenarioId);
            if (existingTenantId == null) {
                throw new ApiException(404, "not_found", "场景不存在");
            }
            verifyTenantOwnership(existingTenantId);
        }

        String id;
        if (req.getId() != null && !req.getId().isEmpty()) {
            weightMapper.updateByIdParams(req.getId(), req.getScenarioId(), req.getTaskId(), req.getWeight());
            id = req.getId();
        } else {
            id = weightMapper.upsertReturnId(tenantId, req.getScenarioId(), req.getTaskId(), req.getWeight());
        }
        SceneWeightConfig w = weightMapper.selectById(id);
        if (w == null) {
            throw new ApiException(500, "internal_error", "更新或创建权重失败");
        }
        WeightDto dto = new WeightDto();
        dto.setId(w.getId());
        dto.setScenarioId(w.getScenarioId());
        dto.setTaskId(w.getTaskId());
        dto.setWeight(w.getWeight());
        return dto;
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(401, "unauthorized", "未授权");
        }
        return userId;
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
