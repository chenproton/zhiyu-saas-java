package org.dromara.zhiyu.service.lesson;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchCreateRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchStatusRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BatchUpdateRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.LessonBatchDto;

/**
 * 课程批次服务（对齐 Go batch_handler.go + store/batch_configs.go NewCourseBatchTableConfig 语义）。
 *
 * @author zhiyu
 */
public interface ILessonBatchService {

    /** 批次列表（orgNodeId/status/majorId/search 过滤）。 */
    ListResponse<LessonBatchDto> list(String orgNodeId, String status, String majorId, String search,
                                      long limit, long offset);

    /** 批次详情。 */
    LessonBatchDto get(String id);

    /** 创建批次（status 默认 open）。 */
    LessonBatchDto create(BatchCreateRequest req);

    /** 更新批次（部分更新语义）。 */
    LessonBatchDto update(String id, BatchUpdateRequest req);

    /** 删除批次。 */
    String delete(String id);

    /** 更新批次状态（open/closed）。 */
    LessonBatchDto updateStatus(String id, BatchStatusRequest req);
}
