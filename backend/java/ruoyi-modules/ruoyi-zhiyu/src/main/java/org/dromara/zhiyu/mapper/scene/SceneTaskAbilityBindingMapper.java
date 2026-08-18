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

    /** 绑定能力点（唯一冲突时幂等），返回 id。 */
    @Insert("INSERT INTO task_ability_bindings (id, tenant_id, task_id, ability_point_id)"
        + " VALUES (gen_random_uuid(), #{tenantId}::uuid, #{taskId}::uuid, #{abilityPointId}::uuid)"
        + " ON CONFLICT (task_id, ability_point_id) DO UPDATE SET task_id = EXCLUDED.task_id RETURNING id")
    String insertReturnId(@Param("tenantId") String tenantId, @Param("taskId") String taskId,
                          @Param("abilityPointId") String abilityPointId);

    /** 查询绑定行关联的任务 ID（归属校验用）。 */
    @Select("SELECT task_id FROM task_ability_bindings WHERE id = #{id}::uuid")
    String selectTaskId(@Param("id") String id);

    /** 解绑（按 id）。 */
    @Delete("DELETE FROM task_ability_bindings WHERE id = #{id}::uuid")
    int deleteByIdParam(@Param("id") String id);
}
