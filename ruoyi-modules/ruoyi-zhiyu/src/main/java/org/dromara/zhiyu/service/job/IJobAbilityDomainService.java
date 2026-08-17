package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityDomainDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityDomainRequest;

/**
 * 能力域服务接口（对齐 Go AbilityDomainHandler）。
 *
 * @author zhiyu
 */
public interface IJobAbilityDomainService {

    /** 能力域列表（careerPositionId 过滤） */
    ListResponse<AbilityDomainDto> list(String careerPositionId, long limit, long offset);

    /** 能力域详情 */
    AbilityDomainDto get(String id);

    /** 创建能力域 */
    AbilityDomainDto create(AbilityDomainRequest req);

    /** 更新能力域 */
    AbilityDomainDto update(String id, AbilityDomainRequest req);

    /** 删除能力域 */
    String delete(String id);
}
