package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneTaskAbilityBinding;

/**
 * 任务-能力点绑定 Mapper（task_ability_bindings 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface SceneTaskAbilityBindingMapper
    extends BaseMapperPlus<SceneTaskAbilityBinding, SceneTaskAbilityBinding> {

    /** 绑定能力点（唯一冲突时幂等）。 */
    @Insert("INSERT INTO task_ability_bindings (id, tenant_id, task_id, ability_point_id)"
        + " VALUES ((UUID()), #{tenantId}, #{taskId}, #{abilityPointId})"
        + " ON DUPLICATE KEY UPDATE task_id = VALUES(task_id)")
    int insertBinding(@Param("tenantId") String tenantId, @Param("taskId") String taskId,
                      @Param("abilityPointId") String abilityPointId);

    /** 回读绑定行 id（唯一键 task_id + ability_point_id）。 */
    @Select("SELECT id FROM task_ability_bindings WHERE task_id = #{taskId}"
        + " AND ability_point_id = #{abilityPointId} LIMIT 1")
    String selectIdByUnique(@Param("taskId") String taskId, @Param("abilityPointId") String abilityPointId);

    /** 查询绑定行关联的任务 ID（归属校验用）。 */
    @Select("SELECT task_id FROM task_ability_bindings WHERE id = #{id}")
    String selectTaskId(@Param("id") String id);

    /** 解绑（按 id，限定租户）。 */
    @Delete("DELETE FROM task_ability_bindings WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteByIdParam(@Param("id") String id, @Param("tenantId") String tenantId);
}
