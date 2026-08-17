package org.dromara.zhiyu.domain.affairs;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 人培方案课程（training_program_courses 表，无 created_at/updated_at/tenant_id）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("training_program_courses")
public class TrainingProgramCourse {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 方案 ID */
    private String programId;

    /** 课程名称 */
    private String name;

    /** 课程编码 */
    private String code;

    /** 学分 */
    private BigDecimal credits;

    /** 总学时 */
    private Integer hours;

    /** 理论学时 */
    private Integer theoryHours;

    /** 实践学时 */
    private Integer practiceHours;

    /** 开课学期 */
    private Integer semester;

    /** 课程性质（必修/选修/实践/场景） */
    private String nature;

    /** 考核方式 */
    private String assessment;

    /** 排序 */
    private Integer sortOrder;

    /** 体系课 ID */
    private String courseId;

    /** 岗位 ID */
    private String positionId;

    // ---------- 关联填充（非表列） ----------

    /** 岗位名称 */
    @TableField(exist = false)
    private String positionName;

    /** 课程名称（体系课） */
    @TableField(exist = false)
    private String courseName;
}
