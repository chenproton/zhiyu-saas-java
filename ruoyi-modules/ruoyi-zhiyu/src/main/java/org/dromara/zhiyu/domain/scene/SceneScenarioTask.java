package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgUuidArrayTypeHandler;

import java.math.BigDecimal;
import java.util.List;

/**
 * 场景任务（scenario_tasks 表，Go→Java 迁移）。
 *
 * <p>本表无 created_at/updated_at 列，故不继承 BaseZhiyuEntity；
 * eval_data 为 jsonb 列，实体以 String 承载（Service 负责 Map 互转）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("scenario_tasks")
public class SceneScenarioTask {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 所属场景 ID */
    private String scenarioId;

    /** 任务名称 */
    private String name;

    /** 任务编码 */
    private String code;

    /** 排序序号 */
    private Integer sortOrder;

    /** 任务描述 */
    private String description;

    /** 详细描述 */
    private String detailedDescription;

    /** 描述 PDF 地址 */
    private String descriptionPdf;

    /** 预估学时 */
    private BigDecimal estimatedHours;

    /** 任务类型（assessment/training） */
    private String taskType;

    /** 难度（1-5） */
    private Integer difficulty;

    /** 任务背景 */
    private String background;

    /** 依赖任务 ID 数组（uuid[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> dependencyIds;

    /** 是否被引用 */
    private Boolean isReferenced;

    /** 来源场景 ID（克隆时记录） */
    private String sourceScenarioId;

    /** 知识点 ID 数组（uuid[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> knowledgePointIds;

    /** 能力点 ID 数组（uuid[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> abilityPointIds;

    /** 资源 ID 数组（uuid[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> resourceIds;

    /** 评估数据（jsonb，原样文本；Service 负责 Map 互转） */
    private String evalData;

    /** 租户 ID */
    private String tenantId;

    /** 能力点名称（JOIN ability_points 结果列，非表列） */
    @TableField(exist = false)
    private List<String> abilityPointNames;

    /** 知识点名称（JOIN knowledge_points 结果列，非表列） */
    @TableField(exist = false)
    private List<String> knowledgePointNames;
}
