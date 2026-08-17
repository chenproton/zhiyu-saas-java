package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 用户角色绑定（user_roles 表，无 created_at/updated_at 列，故不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("user_roles")
public class PortalUserRole {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 用户 ID */
    private String userId;

    /** 角色 ID */
    private String roleId;
}
