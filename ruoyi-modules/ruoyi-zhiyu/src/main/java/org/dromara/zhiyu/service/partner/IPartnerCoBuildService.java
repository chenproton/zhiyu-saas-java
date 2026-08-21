package org.dromara.zhiyu.service.partner;

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

import java.util.Map;

/**
 * 企业端资源共建服务（岗位/场景/任务/权重/测评方式/合作学校只读数据源）。
 *
 * @author zhiyu
 */
public interface IPartnerCoBuildService {

    // 岗位
    ListResponse<CoBuildPositionDto> listPositions(String schoolTenantId, String search, long limit, long offset);

    CoBuildPositionDto getPosition(String id);

    CoBuildPositionDto createPosition(PositionCreateRequest req);

    CoBuildPositionDto updatePosition(String id, PositionCreateRequest req);

    String deletePosition(String id);

    CoBuildPositionDto saveFullPosition(String id, SaveFullPositionRequest req);

    CoBuildPositionDto submitPosition(String id);

    CoBuildPositionDto withdrawPosition(String id);

    CoBuildPositionDto editSourcePosition(String id);

    ListResponse<JobPositionResponsibility> listPositionResponsibilities(String id);

    ListResponse<JobPositionCertificate> listPositionCertificates(String id, long limit, long offset);

    ListResponse<JobPositionAbilityBinding> listPositionAbilityBindings(String id);

    ListResponse<JobAbilityDomain> listPositionAbilityDomains(String id);

    // 场景
    ListResponse<CoBuildScenarioDto> listScenarios(String schoolTenantId, String search, long limit, long offset);

    CoBuildScenarioDto getScenario(String id);

    CoBuildScenarioDto createScenario(ScenarioCreateRequest req);

    CoBuildScenarioDto updateScenario(String id, ScenarioCreateRequest req);

    String deleteScenario(String id);

    CoBuildScenarioDto submitScenario(String id);

    CoBuildScenarioDto withdrawScenario(String id);

    CoBuildScenarioDto editSourceScenario(String id);

    // 任务
    ListResponse<SceneScenarioTask> listTasks(String scenarioId);

    SceneScenarioTask createTask(String scenarioId, TaskRequest req);

    SceneScenarioTask updateTask(String taskId, TaskRequest req);

    String deleteTask(String taskId);

    boolean reorderTasks(String scenarioId, ReorderRequest req);

    // 测评方式
    EvaluationMethodsResponse getTaskEvaluationMethods(String taskId);

    EvaluationMethodsResponse saveTaskEvaluationMethods(String taskId, SaveEvaluationMethodsRequest req);

    // 权重
    ListResponse<SceneWeightConfig> listScenarioWeights(String scenarioId);

    boolean saveScenarioWeights(String scenarioId, SaveWeightsRequest req);

    // 合作学校只读数据源
    ListResponse<JobAbilityPoint> listSchoolAbilities(String schoolTenantId, String search, long limit, long offset);

    ListResponse<SceneRubricTemplate> listSchoolEvaluationMethods(String schoolTenantId, String search, long limit, long offset);

    ListResponse<CoBuildUserOption> listSchoolCoBuilders(String schoolTenantId);

    ListResponse<KnowledgePointDto> listSchoolKnowledgePoints(String schoolTenantId, String search, long limit, long offset);

    ListResponse<LessonCourse> listSchoolCourses(String schoolTenantId, String search, long limit, long offset);

    ListResponse<JobPositionAbilityBinding> listSchoolAbilityBindings(String schoolTenantId, String search, long limit, long offset);

    ListResponse<QuestionBankDto> listSchoolQuestionBanks(String schoolTenantId, String search, long limit, long offset);

    ListResponse<QuestionDto> listSchoolQuestions(String schoolTenantId, String bankId, String search, long limit, long offset);

    ListResponse<RandomDrawQuestionDto> listSchoolRandomDrawQuestions(String schoolTenantId, String search, long limit, long offset);

    ListResponse<PortalExam> listSchoolExams(String schoolTenantId, String search, long limit, long offset);

    ListResponse<MajorDto> listSchoolMajors(String schoolTenantId, String search, long limit, long offset);

    ListResponse<PortalScenario> listSchoolScenarios(String schoolTenantId, String search, long limit, long offset);

    ListResponse<SceneScenarioTask> listSchoolTasks(String schoolTenantId, String search, long limit, long offset);

    ListResponse<ResourceDto> listSchoolResources(String schoolTenantId, String resourceType, String search, long limit, long offset);
}
