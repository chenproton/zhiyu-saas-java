package org.dromara.zhiyu.domain.system;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import org.dromara.zhiyu.core.mybatis.JsonMapTypeHandler;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 角色（roles 表，仅 created_at 列，故不继承 BaseZhiyuEntity；permissions 为 jsonb）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("roles")
public class SystemRole {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 角色码（student/teacher/school_admin 等） */
    private String code;

    /** 角色名 */
    private String name;

    /** 描述 */
    private String description;

    /** 权限（jsonb） */
    @TableField(typeHandler = JsonMapTypeHandler.class)
    private Map<String, Object> permissions;

    /** 用户数 */
    private Integer userCount;

    /** 状态（active/inactive） */
    private String status;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
