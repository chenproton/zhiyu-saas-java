package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 课堂行为记录（lesson_behavior_records 表，出勤/进度统计用）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("lesson_behavior_records")
public class PortalLessonBehavior extends BaseZhiyuEntity {

    /** 课程 ID */
    private String courseId;

    /** 学生用户 ID */
    private String studentUserId;

    /** 出勤（present/absent/late 等） */
    private String attendance;
}
