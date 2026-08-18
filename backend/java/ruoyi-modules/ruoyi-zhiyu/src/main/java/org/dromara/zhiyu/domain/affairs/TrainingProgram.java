package org.dromara.zhiyu.domain.affairs;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;

import java.math.BigDecimal;
import java.util.List;

/**
 * 人才培养方案（training_programs 表，含 created_at/updated_at）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("training_programs")
public class TrainingProgram extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 方案名称 */
    private String name;

    /** 方案编码 */
    private String code;

    /** 专业 ID */
    private String majorId;

    /** 入学年份 */
    private Integer entryYear;

    /** 层次 */
    private String level;

    /** 学制 */
    private Integer duration;

    /** 总学分 */
    private BigDecimal totalCredits;

    /** 状态（draft/pending/approved/rejected/published/archived） */
    private String status;

    /** 描述 */
    private String description;

    /** 创建人 */
    private String createdBy;

    /** 批次 ID */
    private String batchId;

    /** 协作者 ID 数组（uuid[]） */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> collaborators;

    // ---------- 关联填充（非表列） ----------

    /** 专业名称 */
    @TableField(exist = false)
    private String majorName;

    /** 创建人名称 */
    @TableField(exist = false)
    private String createdByName;

    /** 协作者名称数组 */
    @TableField(exist = false)
    private List<String> collaboratorNames;

    /** 批次名称 */
    @TableField(exist = false)
    private String batchName;

    /** 课程数量 */
    @TableField(exist = false)
    private Integer courseCount;
}
