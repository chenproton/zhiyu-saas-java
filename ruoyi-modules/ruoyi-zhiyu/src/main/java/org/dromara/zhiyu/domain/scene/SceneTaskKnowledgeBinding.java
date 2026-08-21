package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 任务-知识点绑定（task_knowledge_bindings 表，Go→Java 迁移）。
 *
 * <p>表无 created_at/updated_at 列，故不继承 BaseZhiyuEntity。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("task_knowledge_bindings")
public class SceneTaskKnowledgeBinding {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 任务 ID */
    private String taskId;

    /** 知识点 ID */
    private String knowledgePointId;

    /** 租户 ID */
    private String tenantId;
}
