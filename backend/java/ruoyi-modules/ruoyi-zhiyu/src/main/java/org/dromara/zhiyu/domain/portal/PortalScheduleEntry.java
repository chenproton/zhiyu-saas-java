package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;

import java.util.List;

/**
 * 排课条目（schedule_entries 表，工作台/我的课表用）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("schedule_entries")
public class PortalScheduleEntry extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 学期 ID */
    private String termId;

    /** 教学计划条目 ID */
    private String planEntryId;

    /** 课程名称 */
    private String courseName;

    /** 课程编码 */
    private String courseCode;

    /** 课程 ID */
    private String courseId;

    /** 类型（traditional/scene） */
    private String type;

    /** 班级组织节点 ID */
    private String classNodeId;

    /** 班级组织节点 ID 数组（多班合并排课） */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> classNodeIds;

    /** 授课教师 ID */
    private String teacherId;

    /** 星期（1-7） */
    private Integer dayOfWeek;

    /** 节次（jsonb 字符串数组） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> periods;

    /** 起始周 */
    private Integer startWeek;

    /** 结束周 */
    private Integer endWeek;

    /** 周次模式（all/odd/even） */
    private String weekPattern;

    /** 场地 ID */
    private String venueId;

    /** 场景 ID */
    private String scenarioId;

    /** 状态（draft/published） */
    private String status;

    /** 来源（manual/auto 等） */
    private String source;

    /** 版本号 */
    private Integer version;

    /** 发布时固化的资源版本 */
    private String resourceVersion;

    /** 场地名称（关联填充，非表列） */
    @TableField(exist = false)
    private String venueName;

    /** 教师名称（关联填充，非表列） */
    @TableField(exist = false)
    private String teacherName;

    /** 班级名称数组（关联填充，非表列） */
    @TableField(exist = false)
    private List<String> classNames;
}
