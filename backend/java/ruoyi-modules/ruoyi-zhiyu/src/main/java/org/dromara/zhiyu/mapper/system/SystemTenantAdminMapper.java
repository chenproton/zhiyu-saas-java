package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.TenantAdminItem;

import java.util.List;

/**
 * 租户管理员 Mapper（users + user_roles + roles 联查，school_admin/enterprise_admin）。
 *
 * @author zhiyu
 */
public interface SystemTenantAdminMapper {

    @Select("SELECT u.id, u.tenant_id, u.username, u.login_name, u.name, u.status, u.last_login_at, u.created_at, u.updated_at"
        + " FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id"
        + " WHERE u.tenant_id = #{tenantId} AND r.code = #{roleCode} ORDER BY u.created_at DESC")
    List<TenantAdminItem> listAdmins(@Param("tenantId") String tenantId, @Param("roleCode") String roleCode);

    @Select("SELECT u.id, u.tenant_id, u.username, u.login_name, u.name, u.status, u.last_login_at, u.created_at, u.updated_at"
        + " FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id"
        + " WHERE u.id = #{adminId} AND u.tenant_id = #{tenantId} AND r.code = #{roleCode}")
    TenantAdminItem getAdmin(@Param("tenantId") String tenantId, @Param("adminId") String adminId,
                             @Param("roleCode") String roleCode);

    @Insert("INSERT INTO users (id, tenant_id, role, platform, login_name, username, password_hash, name, oauth, status)"
        + " VALUES (#{id}, #{tenantId}, #{role}, #{platform}, #{loginName}, #{username}, #{passwordHash}, #{name}, '{}', 'active')")
    int insertAdmin(@Param("id") String id, @Param("tenantId") String tenantId, @Param("role") String role,
                    @Param("platform") String platform, @Param("loginName") String loginName,
                    @Param("username") String username, @Param("passwordHash") String passwordHash,
                    @Param("name") String name);

    @Insert("INSERT INTO user_roles (id, user_id, role_id)"
        + " SELECT #{id}, #{userId}, id FROM roles WHERE tenant_id = #{tenantId} AND code = #{roleCode} LIMIT 1")
    int insertAdminRole(@Param("id") String id, @Param("userId") String userId,
                        @Param("tenantId") String tenantId, @Param("roleCode") String roleCode);

    @Update("UPDATE roles SET user_count = user_count + 1 WHERE tenant_id = #{tenantId} AND code = #{roleCode}")
    int incrementRoleCount(@Param("tenantId") String tenantId, @Param("roleCode") String roleCode);

    @Update("UPDATE users SET username = #{username}, login_name = #{loginName}, name = #{name}, updated_at = NOW()"
        + " WHERE id = #{adminId} AND tenant_id = #{tenantId}")
    int updateAdmin(@Param("tenantId") String tenantId, @Param("adminId") String adminId,
                    @Param("username") String username, @Param("loginName") String loginName, @Param("name") String name);

    @Update("UPDATE roles SET user_count = GREATEST(user_count - 1, 0)"
        + " WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = #{adminId}"
        + " AND user_id IN (SELECT id FROM users WHERE id = #{adminId} AND tenant_id = #{tenantId}))")
    int decrementAdminRoleCount(@Param("tenantId") String tenantId, @Param("adminId") String adminId);

    @Delete("DELETE FROM user_roles WHERE user_id = #{adminId}"
        + " AND user_id IN (SELECT id FROM users WHERE id = #{adminId} AND tenant_id = #{tenantId})")
    int deleteAdminRoles(@Param("tenantId") String tenantId, @Param("adminId") String adminId);

    /**
     * 管理员 id 追加进 tenants.admin_ids（JSON 数组，防重复）。
     *
     * <p>仅当 id 不在数组中时追加：JSON_SEARCH 未命中返回 NULL，JSON_ARRAY_APPEND 会重复追加，
     * 故用 NOT JSON_CONTAINS 条件做幂等（对齐建租户时 updateAdminIds 的首个管理员语义）。</p>
     */
    @Update("UPDATE tenants SET admin_ids = JSON_ARRAY_APPEND(admin_ids, '$', #{adminId})"
        + " WHERE id = #{tenantId} AND NOT JSON_CONTAINS(admin_ids, JSON_QUOTE(#{adminId}))")
    int appendAdminIds(@Param("tenantId") String tenantId, @Param("adminId") String adminId);

    /**
     * 管理员 id 从 tenants.admin_ids（JSON 数组）移除。
     *
     * <p>adminId 不在数组中时 JSON_SEARCH 返回 NULL，原 SQL 会把 NULL 写入 NOT NULL 的
     * admin_ids 列导致 500（Data truncated，删除非首个管理员必现）——
     * 加 IS NOT NULL 条件：未命中时 UPDATE 0 行、值保持不变。</p>
     */
    @Update("UPDATE tenants SET admin_ids = JSON_REMOVE(admin_ids, JSON_UNQUOTE(JSON_SEARCH(admin_ids, 'one', #{adminId})))"
        + " WHERE id = #{tenantId} AND JSON_SEARCH(admin_ids, 'one', #{adminId}) IS NOT NULL")
    int removeFromAdminIds(@Param("tenantId") String tenantId, @Param("adminId") String adminId);

    @Delete("DELETE FROM users WHERE id = #{adminId} AND tenant_id = #{tenantId}")
    int deleteAdmin(@Param("tenantId") String tenantId, @Param("adminId") String adminId);

    @Update("UPDATE users SET password_hash = #{passwordHash}, password_changed_at = NOW(), updated_at = NOW()"
        + " WHERE id = #{adminId} AND tenant_id = #{tenantId}")
    int resetPassword(@Param("tenantId") String tenantId, @Param("adminId") String adminId,
                      @Param("passwordHash") String passwordHash);
}
