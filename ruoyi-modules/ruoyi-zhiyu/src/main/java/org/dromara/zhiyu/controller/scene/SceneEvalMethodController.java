package org.dromara.zhiyu.controller.scene;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.EvalMethodListResponse;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.RubricTemplateDto;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.RubricTemplateRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.SaveEvalMethodsRequest;
import org.dromara.zhiyu.service.scene.ISceneEvalMethodService;
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
 * 任务测评方式 + 评分模板控制器（对齐 Go routes_scene.go 的
 * /scene/tasks/{taskId}/evaluation-methods 与 /scene/rubric-templates 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/scene")
public class SceneEvalMethodController {

    private final ISceneEvalMethodService evalMethodService;

    /** 查询任务全部测评方式（启用+禁用，含评估点/评分规则/评审步骤） */
    @GetMapping("/tasks/{taskId}/evaluation-methods")
    public EvalMethodListResponse listMethods(@PathVariable String taskId) {
        return evalMethodService.listMethods(taskId);
    }

    /** 保存任务测评方式（乐观锁，version 冲突 409） */
    @PutMapping("/tasks/{taskId}/evaluation-methods")
    public EvalMethodListResponse saveMethods(@PathVariable String taskId, @RequestBody SaveEvalMethodsRequest req) {
        return evalMethodService.saveMethods(taskId, req);
    }

    /** 评分模板列表（keyword 搜索） */
    @GetMapping("/rubric-templates")
    public ListResponse<RubricTemplateDto> listTemplates(@RequestParam(value = "limit", required = false) Long limit,
                                                         @RequestParam(value = "offset", required = false) Long offset,
                                                         @RequestParam(value = "keyword", required = false) String keyword) {
        return evalMethodService.listTemplates(keyword,
            limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    /** 评分模板详情 */
    @GetMapping("/rubric-templates/{id}")
    public RubricTemplateDto getTemplate(@PathVariable String id) {
        return evalMethodService.getTemplate(id);
    }

    /** 创建评分模板 */
    @PostMapping("/rubric-templates")
    public RubricTemplateDto createTemplate(@RequestBody RubricTemplateRequest req) {
        return evalMethodService.createTemplate(req);
    }

    /** 更新评分模板 */
    @PutMapping("/rubric-templates/{id}")
    public RubricTemplateDto updateTemplate(@PathVariable String id, @RequestBody RubricTemplateRequest req) {
        return evalMethodService.updateTemplate(id, req);
    }

    /** 软删除评分模板 */
    @DeleteMapping("/rubric-templates/{id}")
    public Map<String, String> deleteTemplate(@PathVariable String id) {
        return Map.of("id", evalMethodService.deleteTemplate(id));
    }
}
