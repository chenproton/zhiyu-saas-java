package org.dromara.zhiyu.controller.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CloneRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.CreateScenarioRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.ScenarioDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.UpdateScenarioRequest;
import org.dromara.zhiyu.service.scene.ISceneScenarioService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 场景控制器（对齐 Go routes_scene.go 的 /scene/scenarios 路由组，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/scene/scenarios")
public class SceneScenarioController {

    private final ISceneScenarioService scenarioService;

    /** 场景列表（limit/offset 分页，status/batchId/careerPositionId/search 过滤） */
    @GetMapping
    public ListResponse<ScenarioDto> list(@RequestParam(value = "limit", required = false) Long limit,
                                          @RequestParam(value = "offset", required = false) Long offset,
                                          @RequestParam(value = "search", required = false) String search,
                                          @RequestParam(value = "status", required = false) String status,
                                          @RequestParam(value = "batchId", required = false) String batchId,
                                          @RequestParam(value = "careerPositionId", required = false) String careerPositionId) {
        return scenarioService.list(search, status, batchId, careerPositionId,
            limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    /** 场景详情（学生仅可读已发布） */
    @GetMapping("/{id}")
    public ScenarioDto get(@PathVariable String id) {
        return scenarioService.get(id);
    }

    /** 创建场景（draft 状态） */
    @PostMapping
    public ScenarioDto create(@RequestBody CreateScenarioRequest req) {
        return scenarioService.create(req);
    }

    /** 更新场景（部分更新语义） */
    @PutMapping("/{id}")
    public ScenarioDto update(@PathVariable String id, @RequestBody UpdateScenarioRequest req) {
        return scenarioService.update(id, req);
    }

    /** 删除场景 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", scenarioService.delete(id));
    }

    /** 提交审核 */
    @PostMapping("/{id}/submit")
    public ScenarioDto submit(@PathVariable String id) {
        return scenarioService.submit(id);
    }

    /** 审核（approved/rejected） */
    @PostMapping("/{id}/review")
    public ScenarioDto review(@PathVariable String id, @RequestBody ReviewRequest req) {
        return scenarioService.review(id, req);
    }

    /** 发布（版本 +0.1，落快照） */
    @PostMapping("/{id}/publish")
    public ScenarioDto publish(@PathVariable String id) {
        return scenarioService.publish(id);
    }

    /** 归档 */
    @PostMapping("/{id}/archive")
    public ScenarioDto archive(@PathVariable String id) {
        return scenarioService.archive(id);
    }

    /** 取消发布 */
    @PostMapping("/{id}/unpublish")
    public ScenarioDto unpublish(@PathVariable String id) {
        return scenarioService.unpublish(id);
    }

    /** 撤回（删除待审批记录） */
    @PostMapping("/{id}/withdraw")
    public ScenarioDto withdraw(@PathVariable String id) {
        return scenarioService.withdraw(id);
    }

    /** 存草稿 */
    @PostMapping("/{id}/save-draft")
    public ScenarioDto saveDraft(@PathVariable String id) {
        return scenarioService.saveDraft(id);
    }

    /** 邀请协作者 */
    @PostMapping("/{id}/invite")
    public ScenarioDto invite(@PathVariable String id, @RequestBody InviteRequest req) {
        return scenarioService.invite(id, req);
    }

    /** 克隆场景（含全部关联，状态重置 draft） */
    @PostMapping("/{id}/clone")
    public ScenarioDto clone(@PathVariable String id, @RequestBody(required = false) CloneRequest req) {
        return scenarioService.clone(id, req == null ? new CloneRequest() : req);
    }

    /** 场景快照 bundle（?version= 可选） */
    @GetMapping("/{id}/snapshot")
    public Map<String, Object> snapshot(@PathVariable String id,
                                        @RequestParam(value = "version", required = false) String version) {
        return scenarioService.getSnapshot(id, version);
    }
}
