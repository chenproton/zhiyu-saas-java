package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.BannerRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.JobBannerConfigDto;

/**
 * 岗位轮播图服务接口（对齐 Go JobBannerHandler）。
 *
 * @author zhiyu
 */
public interface IJobBannerService {

    /** 轮播图列表（isEnabled 过滤） */
    ListResponse<JobBannerConfigDto> list(String isEnabled, long limit, long offset);

    /** 轮播图详情 */
    JobBannerConfigDto get(String id);

    /** 创建轮播图 */
    JobBannerConfigDto create(BannerRequest req);

    /** 更新轮播图（部分更新兜底） */
    JobBannerConfigDto update(String id, BannerRequest req);

    /** 删除轮播图 */
    String delete(String id);
}
