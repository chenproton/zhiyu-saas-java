package org.dromara.zhiyu.service.impl.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BindAbilityRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.BindKnowledgeRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskAbilityBindingDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskKnowledgeBindingDto;
import org.dromara.zhiyu.domain.scene.SceneTaskAbilityBinding;
import org.dromara.zhiyu.domain.scene.SceneTaskKnowledgeBinding;
import org.dromara.zhiyu.mapper.scene.SceneScenarioMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioTaskMapper;
import org.dromara.zhiyu.mapper.scene.SceneTaskAbilityBindingMapper;
import org.dromara.zhiyu.mapper.scene.SceneTaskKnowledgeBindingMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.scene.ISceneTaskBindingService;
import org.springframework.stereotype.Service;

/**
 * 任务知识/能力绑定服务实现（对齐 Go task_knowledge_ability_handler.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SceneTaskBindingServiceImpl implements ISceneTaskBindingService {

    private final SystemGuard systemGuard;
    private final SceneTaskKnowledgeBindingMapper knowledgeMapper;
    private final SceneTaskAbilityBindingMapper abilityMapper;
    private final SceneScenarioTaskMapper taskMapper;
    private final SceneScenarioMapper scenarioMapper;

    @Override
    public TaskKnowledgeBindingDto bindKnowledge(BindKnowledgeRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (isBlank(req.getTaskId()) || isBlank(req.getKnowledgePointId())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        verifyTaskTenant(req.getTaskId());
        knowledgeMapper.insertBinding(tenantId, req.getTaskId(), req.getKnowledgePointId());
        String id = knowledgeMapper.selectIdByUnique(req.getTaskId(), req.getKnowledgePointId());
        return toKnowledgeDto(knowledgeMapper.selectById(id));
    }

    @Override
    public String unbindKnowledge(String id) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        String taskId = knowledgeMapper.selectTaskId(id);
        if (taskId == null) {
            return id;
        }
        verifyTaskTenant(taskId);
        knowledgeMapper.deleteByIdParam(id, tenantId);
        return id;
    }

    @Override
    public TaskAbilityBindingDto bindAbility(BindAbilityRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (isBlank(req.getTaskId()) || isBlank(req.getAbilityPointId())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        verifyTaskTenant(req.getTaskId());
        abilityMapper.insertBinding(tenantId, req.getTaskId(), req.getAbilityPointId());
        String id = abilityMapper.selectIdByUnique(req.getTaskId(), req.getAbilityPointId());
        return toAbilityDto(abilityMapper.selectById(id));
    }

    @Override
    public String unbindAbility(String id) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        String taskId = abilityMapper.selectTaskId(id);
        if (taskId == null) {
            return id;
        }
        verifyTaskTenant(taskId);
        abilityMapper.deleteByIdParam(id, tenantId);
        return id;
    }

    /** 校验任务所属场景的租户归属（task→scenario→tenant 链路）。 */
    private void verifyTaskTenant(String taskId) {
        String scenarioId = taskMapper.selectScenarioId(taskId);
        if (scenarioId == null) {
            throw new ApiException(404, "not_found", "任务不存在");
        }
        String scenarioTenantId = scenarioMapper.selectTenantId(scenarioId);
        if (scenarioTenantId == null) {
            throw new ApiException(404, "not_found", "场景不存在");
        }
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (scenarioTenantId != null && !scenarioTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
    }

    private TaskKnowledgeBindingDto toKnowledgeDto(SceneTaskKnowledgeBinding b) {
        TaskKnowledgeBindingDto dto = new TaskKnowledgeBindingDto();
        if (b != null) {
            dto.setId(b.getId());
            dto.setTaskId(b.getTaskId());
            dto.setKnowledgePointId(b.getKnowledgePointId());
        }
        return dto;
    }

    private TaskAbilityBindingDto toAbilityDto(SceneTaskAbilityBinding b) {
        TaskAbilityBindingDto dto = new TaskAbilityBindingDto();
        if (b != null) {
            dto.setId(b.getId());
            dto.setTaskId(b.getTaskId());
            dto.setAbilityPointId(b.getAbilityPointId());
        }
        return dto;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

}
