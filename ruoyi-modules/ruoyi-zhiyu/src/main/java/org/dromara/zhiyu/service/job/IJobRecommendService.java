package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionRecommendationDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.RecommendRequest;

/**
 * 岗位推荐服务接口（对齐 Go RecommendHandler）。
 *
 * @author zhiyu
 */
public interface IJobRecommendService {

    /** 推荐列表（majorId/careerPositionId 过滤） */
    ListResponse<PositionRecommendationDto> list(String majorId, String careerPositionId, long limit, long offset);

    /** 推荐详情 */
    PositionRecommendationDto get(String id);

    /** 创建推荐（岗位须属于当前租户） */
    PositionRecommendationDto create(RecommendRequest req);

    /** 更新推荐 */
    PositionRecommendationDto update(String id, RecommendRequest req);

    /** 删除推荐 */
    String delete(String id);
}
