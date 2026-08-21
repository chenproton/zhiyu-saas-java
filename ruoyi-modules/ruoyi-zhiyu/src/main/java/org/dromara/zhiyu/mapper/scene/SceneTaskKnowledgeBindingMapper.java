package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneTaskKnowledgeBinding;

/**
 * 任务-知识点绑定 Mapper（task_knowledge_bindings 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface SceneTaskKnowledgeBindingMapper
    extends BaseMapperPlus<SceneTaskKnowledgeBinding, SceneTaskKnowledgeBinding> {

    /** 绑定知识点（唯一冲突时幂等）。 */
    @Insert("INSERT INTO task_knowledge_bindings (id, tenant_id, task_id, knowledge_point_id)"
        + " VALUES ((UUID()), #{tenantId}, #{taskId}, #{knowledgePointId})"
        + " ON DUPLICATE KEY UPDATE task_id = VALUES(task_id)")
    int insertBinding(@Param("tenantId") String tenantId, @Param("taskId") String taskId,
                      @Param("knowledgePointId") String knowledgePointId);

    /** 回读绑定行 id（唯一键 task_id + knowledge_point_id）。 */
    @Select("SELECT id FROM task_knowledge_bindings WHERE task_id = #{taskId}"
        + " AND knowledge_point_id = #{knowledgePointId} LIMIT 1")
    String selectIdByUnique(@Param("taskId") String taskId, @Param("knowledgePointId") String knowledgePointId);

    /** 查询绑定行关联的任务 ID（归属校验用）。 */
    @Select("SELECT task_id FROM task_knowledge_bindings WHERE id = #{id}")
    String selectTaskId(@Param("id") String id);

    /** 解绑（按 id）。 */
    @Delete("DELETE FROM task_knowledge_bindings WHERE id = #{id}")
    int deleteByIdParam(@Param("id") String id);
}
