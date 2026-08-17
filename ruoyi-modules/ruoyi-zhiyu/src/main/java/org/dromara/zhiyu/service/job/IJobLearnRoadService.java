package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.LearnRoadDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.LearnRoadRequest;

/**
 * 学习路径服务接口（对齐 Go LearnRoadHandler）。
 *
 * @author zhiyu
 */
public interface IJobLearnRoadService {

    /** 学习路径列表（name 模糊过滤） */
    ListResponse<LearnRoadDto> list(String name, long limit, long offset);

    /** 学习路径详情 */
    LearnRoadDto get(String id);

    /** 创建学习路径 */
    LearnRoadDto create(LearnRoadRequest req);

    /** 更新学习路径（部分更新语义） */
    LearnRoadDto update(String id, LearnRoadRequest req);

    /** 删除学习路径 */
    String delete(String id);
}
