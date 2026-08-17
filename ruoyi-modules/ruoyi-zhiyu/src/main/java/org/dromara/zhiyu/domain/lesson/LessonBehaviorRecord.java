package org.dromara.zhiyu.domain.lesson;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 课堂行为记录（lesson_behavior_records 表，Go→Java 迁移）。
 *
 * <p>表有 created_at/updated_at 列，故继承 BaseZhiyuEntity。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("lesson_behavior_records")
public class LessonBehaviorRecord extends BaseZhiyuEntity {

    /** 课程 ID */
    private String courseId;

    /** 学生用户 ID */
    private String studentUserId;

    /** 学生姓名（列表 join 组装，非本表列） */
    @TableField(exist = false)
    private String studentName;

    /** 记录日期 */
    private LocalDate recordDate;

    /** 出勤（present/late/absent 等） */
    private String attendance;

    /** 测验得分（可空） */
    private BigDecimal quizScore;

    /** 互动次数 */
    private Integer interactionCount;

    /** 表扬次数 */
    private Integer praiseCount;

    /** 抢答正确数 */
    private Integer rushCorrectCount;

    /** 抢答平均用时（秒，可空） */
    private Integer rushAvgTimeSec;

    /** 租户 ID */
    private String tenantId;
}
