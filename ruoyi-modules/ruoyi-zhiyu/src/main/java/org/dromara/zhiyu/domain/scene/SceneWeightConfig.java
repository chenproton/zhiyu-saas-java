package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 场景任务权重配置（scenario_weight_configs 表，Go→Java 迁移）。
 *
 * <p>本表无 created_at/updated_at 列，故不继承 BaseZhiyuEntity。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("scenario_weight_configs")
public class SceneWeightConfig {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 场景 ID */
    private String scenarioId;

    /** 任务 ID */
    private String taskId;

    /** 权重（0-100） */
    private BigDecimal weight;

    /** 租户 ID */
    private String tenantId;
}
