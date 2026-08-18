package org.dromara.zhiyu.domain.scene;

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
 * 测评评估点（task_eval_points 表，Go→Java 迁移）。
 *
 * <p>grade_mapping 为 jsonb 列，实体以 String 承载（Service 负责互转）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("task_eval_points")
public class SceneEvalPoint extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 所属测评方法配置 ID */
    private String configId;

    /** 评估点名称 */
    private String name;

    /** 描述 */
    private String description;

    /** 子类型 */
    private String subType;

    /** 类型（varchar[]） */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> types;

    /** 权重 */
    private BigDecimal weight;

    /** 评分方式（level 等） */
    private String scoringMethod;

    /** 等级映射（jsonb 原文，数组） */
    private String gradeMapping;

    /** 知识点 ID 数组（uuid[]） */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> knowledgePointIds;

    /** 能力点 ID 数组（uuid[]） */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> abilityPointIds;

    /** 排序序号 */
    private Integer sortOrder;
}
