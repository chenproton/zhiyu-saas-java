package org.dromara.zhiyu.controller.evaluation;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationAbilityItemDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationAbilityPointDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationFullRuleResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationPositionModelDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationRelatedTaskDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationRuleDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationTaskRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CertificationWeightsPayload;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateCertificationItemRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateCertificationPointRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateCertificationRuleRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.PutFullCertificationRuleRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.PutPointLevelsRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StatusRequest;
import org.dromara.zhiyu.service.evaluation.IEvaluationCertificationService;
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
 * 评价域控制器：认证规则（certifications，对齐 Go routes_evaluation.go）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/evaluation/certifications")
public class EvaluationCertificationController {

    private final IEvaluationCertificationService certificationService;

    @GetMapping
    public ListResponse<CertificationRuleDto> listRules(
        @RequestParam(value = "careerPositionId", required = false) String careerPositionId,
        @RequestParam(value = "status", required = false) String status,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return certificationService.listRules(careerPositionId, status,
            limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public CertificationRuleDto getRule(@PathVariable String id) {
        return certificationService.getRule(id);
    }

    @PostMapping
    public CertificationRuleDto createRule(@RequestBody CreateCertificationRuleRequest req) {
        return certificationService.createRule(req);
    }

    @PutMapping("/{id}")
    public CertificationRuleDto updateRule(@PathVariable String id, @RequestBody CreateCertificationRuleRequest req) {
        return certificationService.updateRule(id, req);
    }

    @PostMapping("/{id}/status")
    public CertificationRuleDto updateRuleStatus(@PathVariable String id, @RequestBody StatusRequest req) {
        return certificationService.updateRuleStatus(id, req);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> deleteRule(@PathVariable String id) {
        return Map.of("id", certificationService.deleteRule(id));
    }

    @GetMapping("/{ruleId}/items")
    public ListResponse<CertificationAbilityItemDto> listItems(@PathVariable String ruleId) {
        return certificationService.listItems(ruleId);
    }

    @PostMapping("/{ruleId}/items")
    public CertificationAbilityItemDto createItem(@PathVariable String ruleId,
                                                  @RequestBody CreateCertificationItemRequest req) {
        return certificationService.createItem(ruleId, req);
    }

    @PutMapping("/items/{id}")
    public CertificationAbilityItemDto updateItem(@PathVariable String id, @RequestBody CreateCertificationItemRequest req) {
        return certificationService.updateItem(id, req);
    }

    @DeleteMapping("/items/{id}")
    public Map<String, String> deleteItem(@PathVariable String id) {
        return Map.of("id", certificationService.deleteItem(id));
    }

    @GetMapping("/items/{itemId}/points")
    public ListResponse<CertificationAbilityPointDto> listPoints(@PathVariable String itemId) {
        return certificationService.listPoints(itemId);
    }

    @PostMapping("/items/{itemId}/points")
    public CertificationAbilityPointDto createPoint(@PathVariable String itemId,
                                                    @RequestBody CreateCertificationPointRequest req) {
        return certificationService.createPoint(itemId, req);
    }

    @PutMapping("/points/{id}")
    public CertificationAbilityPointDto updatePoint(@PathVariable String id,
                                                    @RequestBody CreateCertificationPointRequest req) {
        return certificationService.updatePoint(id, req);
    }

    @DeleteMapping("/points/{id}")
    public Map<String, String> deletePoint(@PathVariable String id) {
        return Map.of("id", certificationService.deletePoint(id));
    }

    @PostMapping("/points/{pointId}/tasks")
    public CertificationRelatedTaskDto createTask(@PathVariable String pointId,
                                                  @RequestBody CertificationTaskRequest req) {
        return certificationService.createTask(pointId, req);
    }

    @PutMapping("/tasks/{id}")
    public CertificationRelatedTaskDto updateTask(@PathVariable String id, @RequestBody CertificationTaskRequest req) {
        return certificationService.updateTask(id, req);
    }

    @DeleteMapping("/tasks/{id}")
    public Map<String, String> deleteTask(@PathVariable String id) {
        return Map.of("id", certificationService.deleteTask(id));
    }

    @GetMapping("/{id}/full")
    public CertificationFullRuleResponse getFullRule(@PathVariable String id) {
        return certificationService.getFullRule(id);
    }

    @PutMapping("/{id}/full")
    public CertificationRuleDto putFullRule(@PathVariable String id, @RequestBody PutFullCertificationRuleRequest req) {
        return certificationService.putFullRule(id, req);
    }

    @GetMapping("/positions/{positionId}/model")
    public CertificationPositionModelDto getPositionModel(@PathVariable String positionId) {
        return certificationService.getPositionModel(positionId);
    }

    @PutMapping("/positions/{positionId}/weights")
    public CertificationRuleDto putWeights(@PathVariable String positionId,
                                           @RequestBody CertificationWeightsPayload req) {
        return certificationService.putWeights(positionId, req);
    }

    @PutMapping("/positions/{positionId}/points/{abilityPointId}/levels")
    public Map<String, String> putPointLevels(@PathVariable String positionId,
                                              @PathVariable String abilityPointId,
                                              @RequestBody PutPointLevelsRequest req) {
        return certificationService.putPointLevels(positionId, abilityPointId, req);
    }
}
