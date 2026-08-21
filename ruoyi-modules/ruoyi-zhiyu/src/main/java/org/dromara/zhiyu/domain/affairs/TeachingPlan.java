package org.dromara.zhiyu.domain.affairs;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 教学计划（teaching_plans 表，无 created_at 列，仅 updated_at，故不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("teaching_plans")
public class TeachingPlan {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 人培方案 ID */
    private String programId;

    /** 学期 ID */
    private String termId;

    /** 专业 ID */
    private String majorId;

    /** 入学年份 */
    private Integer entryYear;

    /** 状态（draft/pending/approved/rejected/published/archived） */
    private String status;

    /** 生成时间 */
    private OffsetDateTime generatedAt;

    /** 确认时间 */
    private OffsetDateTime confirmedAt;

    /** 批次 ID */
    private String batchId;

    /** 协作者 ID 数组（uuid[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> collaborators;

    /** 创建人 */
    private String createdBy;

    /** 更新时间 */
    private OffsetDateTime updatedAt;

    // ---------- 关联填充（非表列） ----------

    /** 方案名称 */
    @TableField(exist = false)
    private String programName;

    /** 学期名称 */
    @TableField(exist = false)
    private String termName;

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

    /** 条目数量 */
    @TableField(exist = false)
    private Integer entryCount;
}
