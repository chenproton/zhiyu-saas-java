package org.dromara.zhiyu.controller.partner;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.partner.CoBuildPositionDto;
import org.dromara.zhiyu.domain.dto.partner.CoBuildScenarioDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CoBuildUserOption;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.EvaluationMethodsResponse;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.PositionCreateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ReorderRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.SaveEvaluationMethodsRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.SaveFullPositionRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.SaveWeightsRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ScenarioCreateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.TaskRequest;
import org.dromara.zhiyu.domain.job.JobAbilityDomain;
import org.dromara.zhiyu.domain.job.JobAbilityPoint;
import org.dromara.zhiyu.domain.job.JobPositionAbilityBinding;
import org.dromara.zhiyu.domain.job.JobPositionCertificate;
import org.dromara.zhiyu.domain.job.JobPositionResponsibility;
import org.dromara.zhiyu.domain.lesson.LessonCourse;
import org.dromara.zhiyu.domain.portal.PortalExam;
import org.dromara.zhiyu.domain.portal.PortalScenario;
import org.dromara.zhiyu.domain.scene.SceneRubricTemplate;
import org.dromara.zhiyu.domain.scene.SceneScenarioTask;
import org.dromara.zhiyu.domain.scene.SceneWeightConfig;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.KnowledgePointDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.MajorDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.QuestionBankDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.QuestionDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.RandomDrawQuestionDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos.ResourceDto;
import org.dromara.zhiyu.service.partner.IPartnerCoBuildService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 企业端资源共建控制器（对齐 Go routes_partner.go 共建路由，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/partner/co-build")
public class PartnerCoBuildController {

    private final IPartnerCoBuildService coBuildService;

    // ===== 岗位 =====

    @GetMapping("/positions")
    public ListResponse<CoBuildPositionDto> listPositions(
        @RequestParam(value = "schoolTenantId", required = false) String schoolTenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listPositions(schoolTenantId, search, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @PostMapping("/positions")
    @ResponseStatus(HttpStatus.CREATED)
    public CoBuildPositionDto createPosition(@RequestBody PositionCreateRequest req) {
        return coBuildService.createPosition(req);
    }

    @GetMapping("/positions/{id}")
    public CoBuildPositionDto getPosition(@PathVariable String id) {
        return coBuildService.getPosition(id);
    }

    @PostMapping("/positions/{id}/edit")
    public CoBuildPositionDto editSourcePosition(@PathVariable String id) {
        return coBuildService.editSourcePosition(id);
    }

    @PutMapping("/positions/{id}")
    public CoBuildPositionDto updatePosition(@PathVariable String id, @RequestBody PositionCreateRequest req) {
        return coBuildService.updatePosition(id, req);
    }

    @DeleteMapping("/positions/{id}")
    public Map<String, String> deletePosition(@PathVariable String id) {
        return Map.of("id", coBuildService.deletePosition(id));
    }

    @PostMapping("/positions/{id}/submit")
    public CoBuildPositionDto submitPosition(@PathVariable String id) {
        return coBuildService.submitPosition(id);
    }

    @PostMapping("/positions/{id}/withdraw")
    public CoBuildPositionDto withdrawPosition(@PathVariable String id) {
        return coBuildService.withdrawPosition(id);
    }

    @PostMapping("/positions/{id}/save-full")
    public CoBuildPositionDto saveFullPosition(@PathVariable String id, @RequestBody SaveFullPositionRequest req) {
        return coBuildService.saveFullPosition(id, req);
    }

    @GetMapping("/positions/{id}/responsibilities")
    public ListResponse<JobPositionResponsibility> listPositionResponsibilities(@PathVariable String id) {
        return coBuildService.listPositionResponsibilities(id);
    }

    @GetMapping("/positions/{id}/certificates")
    public ListResponse<JobPositionCertificate> listPositionCertificates(@PathVariable String id,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listPositionCertificates(id, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/positions/{id}/ability-bindings")
    public ListResponse<JobPositionAbilityBinding> listPositionAbilityBindings(@PathVariable String id) {
        return coBuildService.listPositionAbilityBindings(id);
    }

    @GetMapping("/positions/{id}/ability-domains")
    public ListResponse<JobAbilityDomain> listPositionAbilityDomains(@PathVariable String id) {
        return coBuildService.listPositionAbilityDomains(id);
    }

    // ===== 场景 =====

    @GetMapping("/scenes")
    public ListResponse<CoBuildScenarioDto> listScenarios(
        @RequestParam(value = "schoolTenantId", required = false) String schoolTenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listScenarios(schoolTenantId, search, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    @PostMapping("/scenes")
    @ResponseStatus(HttpStatus.CREATED)
    public CoBuildScenarioDto createScenario(@RequestBody ScenarioCreateRequest req) {
        return coBuildService.createScenario(req);
    }

    @GetMapping("/scenes/{id}")
    public CoBuildScenarioDto getScenario(@PathVariable String id) {
        return coBuildService.getScenario(id);
    }

    @PostMapping("/scenes/{id}/edit")
    public CoBuildScenarioDto editSourceScenario(@PathVariable String id) {
        return coBuildService.editSourceScenario(id);
    }

    @PutMapping("/scenes/{id}")
    public CoBuildScenarioDto updateScenario(@PathVariable String id, @RequestBody ScenarioCreateRequest req) {
        return coBuildService.updateScenario(id, req);
    }

    @DeleteMapping("/scenes/{id}")
    public Map<String, String> deleteScenario(@PathVariable String id) {
        return Map.of("id", coBuildService.deleteScenario(id));
    }

    @PostMapping("/scenes/{id}/submit")
    public CoBuildScenarioDto submitScenario(@PathVariable String id) {
        return coBuildService.submitScenario(id);
    }

    @PostMapping("/scenes/{id}/withdraw")
    public CoBuildScenarioDto withdrawScenario(@PathVariable String id) {
        return coBuildService.withdrawScenario(id);
    }

    // ===== 任务 =====

    @GetMapping("/scenes/{scenarioId}/tasks")
    public ListResponse<SceneScenarioTask> listTasks(@PathVariable String scenarioId) {
        return coBuildService.listTasks(scenarioId);
    }

    @PostMapping("/scenes/{scenarioId}/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public SceneScenarioTask createTask(@PathVariable String scenarioId, @RequestBody TaskRequest req) {
        return coBuildService.createTask(scenarioId, req);
    }

    @PostMapping("/scenes/{scenarioId}/tasks/reorder")
    public Map<String, Boolean> reorderTasks(@PathVariable String scenarioId, @RequestBody ReorderRequest req) {
        return Map.of("ok", coBuildService.reorderTasks(scenarioId, req));
    }

    @PutMapping("/tasks/{taskId}")
    public SceneScenarioTask updateTask(@PathVariable String taskId, @RequestBody TaskRequest req) {
        return coBuildService.updateTask(taskId, req);
    }

    @DeleteMapping("/tasks/{taskId}")
    public Map<String, String> deleteTask(@PathVariable String taskId) {
        return Map.of("id", coBuildService.deleteTask(taskId));
    }

    @GetMapping("/tasks/{taskId}/evaluation-methods")
    public EvaluationMethodsResponse getTaskEvaluationMethods(@PathVariable String taskId) {
        return coBuildService.getTaskEvaluationMethods(taskId);
    }

    @PutMapping("/tasks/{taskId}/evaluation-methods")
    public EvaluationMethodsResponse saveTaskEvaluationMethods(@PathVariable String taskId,
                                                               @RequestBody SaveEvaluationMethodsRequest req) {
        return coBuildService.saveTaskEvaluationMethods(taskId, req);
    }

    // ===== 权重 =====

    @GetMapping("/scenes/{scenarioId}/weights")
    public ListResponse<SceneWeightConfig> listScenarioWeights(@PathVariable String scenarioId) {
        return coBuildService.listScenarioWeights(scenarioId);
    }

    @PutMapping("/scenes/{scenarioId}/weights")
    public Map<String, Boolean> saveScenarioWeights(@PathVariable String scenarioId, @RequestBody SaveWeightsRequest req) {
        return Map.of("ok", coBuildService.saveScenarioWeights(scenarioId, req));
    }

    // ===== 合作学校只读数据源 =====

    @GetMapping("/schools/{tenantId}/abilities")
    public ListResponse<JobAbilityPoint> listSchoolAbilities(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolAbilities(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/evaluation-methods")
    public ListResponse<SceneRubricTemplate> listSchoolEvaluationMethods(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolEvaluationMethods(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/co-builders")
    public ListResponse<CoBuildUserOption> listSchoolCoBuilders(@PathVariable String tenantId) {
        return coBuildService.listSchoolCoBuilders(tenantId);
    }

    @GetMapping("/schools/{tenantId}/knowledge-points")
    public ListResponse<KnowledgePointDto> listSchoolKnowledgePoints(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolKnowledgePoints(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/courses")
    public ListResponse<LessonCourse> listSchoolCourses(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolCourses(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/ability-bindings")
    public ListResponse<JobPositionAbilityBinding> listSchoolAbilityBindings(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolAbilityBindings(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/question-banks")
    public ListResponse<QuestionBankDto> listSchoolQuestionBanks(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolQuestionBanks(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/questions")
    public ListResponse<QuestionDto> listSchoolQuestions(@PathVariable String tenantId,
        @RequestParam(value = "bankId", required = false) String bankId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolQuestions(tenantId, bankId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/random-draw-questions")
    public ListResponse<RandomDrawQuestionDto> listSchoolRandomDrawQuestions(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolRandomDrawQuestions(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/exams")
    public ListResponse<PortalExam> listSchoolExams(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolExams(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/majors")
    public ListResponse<MajorDto> listSchoolMajors(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolMajors(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/scenarios")
    public ListResponse<PortalScenario> listSchoolScenarios(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolScenarios(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/tasks")
    public ListResponse<SceneScenarioTask> listSchoolTasks(@PathVariable String tenantId,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolTasks(tenantId, search, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/schools/{tenantId}/resources")
    public ListResponse<ResourceDto> listSchoolResources(@PathVariable String tenantId,
        @RequestParam(value = "resourceType", required = false) String resourceType,
        @RequestParam(value = "search", required = false) String search,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return coBuildService.listSchoolResources(tenantId, resourceType, search, limit == null ? 50 : limit, offset == null ? 0 : offset);
    }
}
