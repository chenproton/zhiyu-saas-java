package org.dromara.zhiyu.service.evaluation;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.AppealDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateAppealRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ProcessAppealRequest;

/**
 * 申诉服务（对齐 Go appeal_handler.go + store/appeal.go 语义）。
 *
 * @author zhiyu
 */
public interface IEvaluationAppealService {

    /** 申诉列表（type/status 过滤）。 */
    ListResponse<AppealDto> list(String type, String status, long limit, long offset);

    /** 申诉详情（跨租户 404）。 */
    AppealDto get(String id);

    /** 创建申诉。 */
    AppealDto create(CreateAppealRequest req);

    /** 处理申诉（approved/rejected，学生不可处理）。 */
    AppealDto process(String id, ProcessAppealRequest req);
}
