package org.dromara.zhiyu.domain.affairs;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 教学计划条目（teaching_plan_entries 表，无 created_at/updated_at/tenant_id）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("teaching_plan_entries")
public class TeachingPlanEntry {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 计划 ID */
    private String planId;

    /** 课程名称 */
    private String courseName;

    /** 课程编码 */
    private String courseCode;

    /** 类型（theory/practice/scene） */
    private String type;

    /** 课程性质 */
    private String nature;

    /** 学分 */
    private BigDecimal credits;

    /** 总学时 */
    private Integer totalHours;

    /** 周学时 */
    private Integer weekHours;

    /** 起始周 */
    private Integer startWeek;

    /** 结束周 */
    private Integer endWeek;

    /** 周次模式（all/odd/even） */
    private String weekPattern;

    /** 班级组织节点 ID */
    private String classNodeId;

    /** 授课教师 ID */
    private String teacherId;

    /** 教师类型 */
    private String teacherType;

    /** 场地类型 */
    private String venueType;

    /** 场景 ID */
    private String scenarioId;

    /** 状态（planned/scheduled） */
    private String status;

    /** 体系课 ID */
    private String courseId;

    // ---------- 关联填充（非表列） ----------

    /** 班级名称 */
    @TableField(exist = false)
    private String className;

    /** 班级组织节点 ID 数组（junction 表） */
    @TableField(exist = false)
    private List<String> classNodeIds;

    /** 班级名称数组 */
    @TableField(exist = false)
    private List<String> classNames;

    /** 教师名称 */
    @TableField(exist = false)
    private String teacherName;

    /** 场景名称 */
    @TableField(exist = false)
    private String scenarioName;

    /** 岗位名称 */
    @TableField(exist = false)
    private String positionName;

    /** 体系课名称 */
    @TableField(exist = false)
    private String linkedCourseName;
}
