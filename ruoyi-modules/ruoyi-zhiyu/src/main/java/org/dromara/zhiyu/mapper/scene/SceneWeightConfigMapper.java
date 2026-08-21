package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneWeightConfig;

import java.math.BigDecimal;

/**
 * 场景权重配置 Mapper（scenario_weight_configs 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface SceneWeightConfigMapper extends BaseMapperPlus<SceneWeightConfig, SceneWeightConfig> {

    /**
     * 权重 upsert（scenario_id+task_id 唯一冲突时更新权重；对齐 Go ScenarioWeightStore.Upsert）。
     */
    @Insert("INSERT INTO scenario_weight_configs (tenant_id, scenario_id, task_id, weight)"
        + " VALUES (#{tenantId}, #{scenarioId}, #{taskId}, #{weight})"
        + " ON DUPLICATE KEY UPDATE weight = VALUES(weight)")
    int upsert(@Param("tenantId") String tenantId, @Param("scenarioId") String scenarioId,
               @Param("taskId") String taskId, @Param("weight") BigDecimal weight);

    /** 回读权重配置行 id（唯一键 scenario_id + task_id）。 */
    @Select("SELECT id FROM scenario_weight_configs WHERE scenario_id = #{scenarioId} AND task_id = #{taskId} LIMIT 1")
    String selectIdByUnique(@Param("scenarioId") String scenarioId, @Param("taskId") String taskId);

    /**
     * 更新权重（按 id；对齐 Go Upsert 的 ID 分支）。
     */
    @Update("UPDATE scenario_weight_configs SET scenario_id = #{scenarioId}, task_id = #{taskId}, weight = #{weight}"
        + " WHERE id = #{id}")
    int updateByIdParams(@Param("id") String id, @Param("scenarioId") String scenarioId,
                         @Param("taskId") String taskId, @Param("weight") BigDecimal weight);

    /**
     * 查询权重配置所属场景 ID（归属校验用）。
     */
    @Select("SELECT scenario_id FROM scenario_weight_configs WHERE id = #{id}")
    String selectScenarioId(@Param("id") String id);
}
