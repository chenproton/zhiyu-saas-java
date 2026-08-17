package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneTaskResourceBinding;

/**
 * 任务-资源绑定 Mapper（task_resource_bindings 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface SceneTaskResourceBindingMapper extends BaseMapperPlus<SceneTaskResourceBinding, SceneTaskResourceBinding> {

    /**
     * 绑定资源（唯一冲突时幂等更新，返回绑定行 id；对齐 Go ResourceBindingStore.Bind 的 DO UPDATE 语义）。
     */
    @Select("INSERT INTO task_resource_bindings (tenant_id, task_id, resource_id)"
        + " VALUES (#{tenantId}, #{taskId}, #{resourceId})"
        + " ON CONFLICT (task_id, resource_id) DO UPDATE SET task_id = EXCLUDED.task_id"
        + " RETURNING id")
    String bindReturnId(@Param("tenantId") String tenantId, @Param("taskId") String taskId,
                        @Param("resourceId") String resourceId);

    /**
     * 查询绑定行关联的任务 ID（归属校验用；无行返回 null）。
     */
    @Select("SELECT task_id FROM task_resource_bindings WHERE id = #{id}")
    String selectTaskId(@Param("id") String id);

    /**
     * 解绑（绑定不存在时静默成功，对齐 Go Unbind 幂等语义）。
     */
    @Delete("DELETE FROM task_resource_bindings WHERE id = #{id}")
    int unbind(@Param("id") String id);
}
