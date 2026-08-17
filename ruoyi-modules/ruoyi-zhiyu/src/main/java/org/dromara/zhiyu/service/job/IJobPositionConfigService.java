package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionAbilityBindingDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionAbilityRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionCertificateDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionCertificateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionResponsibilityDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionResponsibilityRequest;

/**
 * 岗位配置服务接口（对齐 Go PositionConfigService：能力绑定/职责/证书）。
 *
 * @author zhiyu
 */
public interface IJobPositionConfigService {

    // ---------- 岗位-能力绑定 ----------

    /** 能力绑定列表（careerPositionId/responsibilityId 过滤） */
    ListResponse<PositionAbilityBindingDto> listBindings(String careerPositionId, String responsibilityId,
                                                         long limit, long offset);

    /** 创建能力绑定（校验岗位/职责/能力点归属） */
    PositionAbilityBindingDto createBinding(PositionAbilityRequest req);

    /** 更新能力绑定（部分更新兜底） */
    PositionAbilityBindingDto updateBinding(String id, PositionAbilityRequest req);

    /** 删除能力绑定 */
    String deleteBinding(String id);

    // ---------- 岗位职责 ----------

    /** 岗位职责列表（careerPositionId 过滤） */
    ListResponse<PositionResponsibilityDto> listResponsibilities(String careerPositionId, long limit, long offset);

    /** 岗位职责详情（经关联岗位做间接租户校验） */
    PositionResponsibilityDto getResponsibility(String id);

    /** 创建岗位职责 */
    PositionResponsibilityDto createResponsibility(PositionResponsibilityRequest req);

    /** 更新岗位职责 */
    PositionResponsibilityDto updateResponsibility(String id, PositionResponsibilityRequest req);

    /** 删除岗位职责 */
    String deleteResponsibility(String id);

    // ---------- 岗位证书 ----------

    /** 岗位证书列表（careerPositionId 必填；空则返回空列表） */
    ListResponse<PositionCertificateDto> listCertificates(String careerPositionId, long limit, long offset);

    /** 岗位证书详情（经关联岗位做间接租户校验） */
    PositionCertificateDto getCertificate(String id);

    /** 创建岗位证书（find-or-create 证书库条目） */
    PositionCertificateDto createCertificate(PositionCertificateRequest req);

    /** 更新岗位证书 */
    PositionCertificateDto updateCertificate(String id, PositionCertificateRequest req);

    /** 删除岗位证书 */
    String deleteCertificate(String id);
}
