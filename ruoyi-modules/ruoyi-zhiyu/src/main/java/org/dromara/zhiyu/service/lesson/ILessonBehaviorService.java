package org.dromara.zhiyu.service.lesson;

import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BehaviorAggregateDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BehaviorRecordDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateBehaviorRecordRequest;

/**
 * 课堂行为服务（对齐 Go lesson_behavior_handler.go + service/lesson_behavior_aggregate.go 语义）。
 *
 * @author zhiyu
 */
public interface ILessonBehaviorService {

    /** 行为聚合（courseId 为空时返回空聚合）。 */
    BehaviorAggregateDto aggregate(String courseId, String startDate, String endDate);

    /** 保存行为记录（幂等 upsert）。 */
    BehaviorRecordDto create(CreateBehaviorRecordRequest req);
}
