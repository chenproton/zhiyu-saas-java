package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 场景任务（scenario_tasks 表，无 created_at/updated_at 列，故不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("scenario_tasks")
public class PortalScenarioTask {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 所属场景 ID */
    private String scenarioId;

    /** 任务名称 */
    private String name;

    /** 难度（1-5） */
    private Integer difficulty;
}
