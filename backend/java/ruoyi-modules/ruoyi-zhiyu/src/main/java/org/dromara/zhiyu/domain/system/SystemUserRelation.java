package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 用户关系（user_relations 表，仅 created_at 列）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("user_relations")
public class SystemUserRelation {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 发起者 ID */
    private String initiatorId;

    /** 发起者组织节点 ID */
    private String initiatorOrgNodeId;

    /** 目标 ID */
    private String targetId;

    /** 目标组织节点 ID */
    private String targetOrgNodeId;

    /** 关系类型 */
    private String relationType;

    /** 描述 */
    private String description;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
