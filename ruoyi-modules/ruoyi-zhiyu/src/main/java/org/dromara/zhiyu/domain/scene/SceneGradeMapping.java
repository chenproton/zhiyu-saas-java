package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 场景等级映射（scenario_grade_mappings 表，Go→Java 迁移）。
 *
 * <p>表无 created_at/updated_at 列，故不继承 BaseZhiyuEntity。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("scenario_grade_mappings")
public class SceneGradeMapping {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 场景 ID */
    private String scenarioId;

    /** 任务 ID（可空） */
    private String taskId;

    /** 等级 */
    private String level;

    /** 最低分 */
    private BigDecimal minScore;

    /** 最高分 */
    private BigDecimal maxScore;

    /** 等级描述 */
    private String description;

    /** 颜色 */
    private String color;

    /** 租户 ID */
    private String tenantId;
}
