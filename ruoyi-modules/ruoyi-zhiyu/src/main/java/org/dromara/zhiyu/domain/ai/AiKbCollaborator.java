package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 知识库协作者（ai_kb_collaborators 表，Go→Java 迁移；无 updated_at 列）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_kb_collaborators")
public class AiKbCollaborator {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 知识库 ID */
    private String kbId;

    /** 用户 ID */
    private String userId;

    /** 角色（editor/viewer） */
    private String role;

    /** 创建时间 */
    private OffsetDateTime createdAt;

    /** 用户姓名（视图扩展字段，非表列） */
    @TableField(exist = false)
    private String userName;
}
