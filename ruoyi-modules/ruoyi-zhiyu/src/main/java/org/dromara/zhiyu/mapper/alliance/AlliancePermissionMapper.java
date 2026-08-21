package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AlliancePermission;

/**
 * 联盟权限项 Mapper（alliance_permissions 表）。
 *
 * @author zhiyu
 */
public interface AlliancePermissionMapper extends BaseMapperPlus<AlliancePermission, AlliancePermission> {

    @Insert("INSERT INTO alliance_permissions (id, tenant_id, account_name, account_type, enterprise_id, expert_id,"
        + " is_enabled, resource_permissions, platform_permissions, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{accountName}, #{accountType}, #{enterpriseId}, #{expertId},"
        + " #{isEnabled}, CAST(#{resourcePermissions} AS JSON), CAST(#{platformPermissions} AS JSON), NOW(), NOW())")
    int insertPermission(AlliancePermission p);

    @Update("UPDATE alliance_permissions SET account_name = #{accountName}, account_type = #{accountType},"
        + " enterprise_id = #{enterpriseId}, expert_id = #{expertId}, is_enabled = #{isEnabled},"
        + " resource_permissions = CAST(#{resourcePermissions} AS JSON),"
        + " platform_permissions = CAST(#{platformPermissions} AS JSON), updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updatePermission(AlliancePermission p);

    @Delete("DELETE FROM alliance_permissions WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deletePermission(@Param("id") String id, @Param("tenantId") String tenantId);
}
