package org.dromara.zhiyu.service.evaluation;

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

import java.util.Map;

/**
 * 认证规则服务（certifications），对齐 Go CertificationHandler +
 * CertificationModelHandler + service/evaluation_cert.go。
 *
 * @author zhiyu
 */
public interface IEvaluationCertificationService {

    org.dromara.zhiyu.core.page.ListResponse<CertificationRuleDto> listRules(String careerPositionId, String status,
                                                                             long limit, long offset);

    CertificationRuleDto getRule(String id);

    CertificationRuleDto createRule(CreateCertificationRuleRequest req);

    CertificationRuleDto updateRule(String id, CreateCertificationRuleRequest req);

    CertificationRuleDto updateRuleStatus(String id, StatusRequest req);

    String deleteRule(String id);

    org.dromara.zhiyu.core.page.ListResponse<CertificationAbilityItemDto> listItems(String ruleId);

    CertificationAbilityItemDto createItem(String ruleId, CreateCertificationItemRequest req);

    CertificationAbilityItemDto updateItem(String id, CreateCertificationItemRequest req);

    String deleteItem(String id);

    org.dromara.zhiyu.core.page.ListResponse<CertificationAbilityPointDto> listPoints(String itemId);

    CertificationAbilityPointDto createPoint(String itemId, CreateCertificationPointRequest req);

    CertificationAbilityPointDto updatePoint(String id, CreateCertificationPointRequest req);

    String deletePoint(String id);

    CertificationRelatedTaskDto createTask(String pointId, CertificationTaskRequest req);

    CertificationRelatedTaskDto updateTask(String id, CertificationTaskRequest req);

    String deleteTask(String id);

    CertificationFullRuleResponse getFullRule(String id);

    CertificationRuleDto putFullRule(String id, PutFullCertificationRuleRequest req);

    CertificationPositionModelDto getPositionModel(String positionId);

    CertificationRuleDto putWeights(String positionId, CertificationWeightsPayload req);

    Map<String, String> putPointLevels(String positionId, String abilityPointId, PutPointLevelsRequest req);
}
