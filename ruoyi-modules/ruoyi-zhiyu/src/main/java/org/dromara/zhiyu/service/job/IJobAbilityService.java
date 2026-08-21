package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityPointDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.AbilityRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.UncitedItemDto;

/**
 * 能力点服务接口（对齐 Go AbilityHandler）。
 *
 * @author zhiyu
 */
public interface IJobAbilityService {

    /** 能力点列表（search/isPublic/creatorId 过滤） */
    ListResponse<AbilityPointDto> list(String search, String isPublic, String creatorId, long limit, long offset);

    /** 能力点详情 */
    AbilityPointDto get(String id);

    /** 创建能力点（NL 编码） */
    AbilityPointDto create(AbilityRequest req);

    /** 更新能力点 */
    AbilityPointDto update(String id, AbilityRequest req);

    /** 删除能力点 */
    String delete(String id);

    /** 引用次数分布统计 */
    CitationStatsDto citationStats();

    /** 零引用能力点列表（创建时段筛选 + 分页） */
    ListResponse<UncitedItemDto> uncited(String startDate, String endDate, long limit, long offset);
}
