package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.system.SystemRole;

import java.util.List;

/**
 * 角色 Mapper（roles 表）。
 *
 * @author zhiyu
 */
public interface SystemRoleMapper extends BaseMapperPlus<SystemRole, SystemRole> {

    @Insert("INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, #{description},"
        + " CAST(#{permissions, typeHandler=org.dromara.zhiyu.core.mybatis.JsonMapTypeHandler} AS JSON), 0, 'active')")
    int insertRole(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                   @Param("name") String name, @Param("description") String description,
                   @Param("permissions") java.util.Map<String, Object> permissions);

    @Update("UPDATE roles SET name = #{name}, description = #{description},"
        + " permissions = CAST(#{permissions, typeHandler=org.dromara.zhiyu.core.mybatis.JsonMapTypeHandler} AS JSON)"
        + " WHERE id = #{id}")
    int updateRole(@Param("id") String id, @Param("name") String name, @Param("description") String description,
                   @Param("permissions") java.util.Map<String, Object> permissions);

    @Delete("DELETE FROM roles WHERE id = #{id}")
    int deleteRole(@Param("id") String id);

    /** 删除角色前先清理 user_roles 引用（事务内）。 */
    @Delete("DELETE FROM user_roles WHERE role_id = #{id}")
    int deleteUserRoles(@Param("id") String id);

    /** 查询用户所属租户（分配角色前归属校验）。 */
    @Select("SELECT tenant_id FROM users WHERE id = #{userId}")
    String selectUserTenantId(@Param("userId") String userId);

    /** 为用户分配角色（维护 user_count）。 */
    @Insert("INSERT INTO user_roles (id, user_id, role_id) VALUES (#{id}, #{userId}, #{roleId})"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertUserRole(@Param("id") String id, @Param("userId") String userId, @Param("roleId") String roleId);

    @Update("UPDATE roles SET user_count = user_count + 1 WHERE id = #{roleId} AND tenant_id = #{tenantId}")
    int incrementUserCount(@Param("roleId") String roleId, @Param("tenantId") String tenantId);

    /** 查询用户全部角色码（user_roles JOIN roles，按创建时间排序）。 */
    @Select("SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id"
        + " WHERE ur.user_id = #{userId} ORDER BY r.created_at")
    List<String> selectRoleCodesByUser(@Param("userId") String userId);

    /** 查询用户全部角色（user_roles JOIN roles，按创建时间排序）。 */
    @Select("SELECT r.id, r.tenant_id, r.code, r.name, r.description, r.permissions,"
        + " r.user_count, r.status, r.created_at"
        + " FROM user_roles ur JOIN roles r ON r.id = ur.role_id"
        + " WHERE ur.user_id = #{userId} ORDER BY r.created_at")
    List<SystemRole> selectRolesByUser(@Param("userId") String userId);

    /** 删除用户的全部角色绑定（bind/rebind/delete 前；租户条件作纵深防御，防跨租户 IDOR）。 */
    @Delete("DELETE FROM user_roles WHERE user_id = #{userId}"
        + " AND EXISTS (SELECT 1 FROM users u WHERE u.id = #{userId} AND u.tenant_id = #{tenantId})")
    int deleteUserRolesByUser(@Param("userId") String userId, @Param("tenantId") String tenantId);

    /** 递减用户当前角色计数（bind/rebind/delete 前；租户条件作纵深防御，防跨租户 IDOR）。 */
    @Update("UPDATE roles SET user_count = GREATEST(user_count - 1, 0)"
        + " WHERE id IN (SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = #{userId}"
        + " AND EXISTS (SELECT 1 FROM users u WHERE u.id = #{userId} AND u.tenant_id = #{tenantId}))")
    int decrementUserCountsByUser(@Param("userId") String userId, @Param("tenantId") String tenantId);

    /** 递减单角色计数。 */
    @Update("UPDATE roles SET user_count = GREATEST(user_count - 1, 0) WHERE id = #{roleId}")
    int decrementUserCount(@Param("roleId") String roleId);

    /** 批量查询用户角色绑定（id/code/name，attachRoles 用）。 */
    @Select("SELECT ur.user_id, r.id, r.code, r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id"
        + " WHERE JSON_CONTAINS(CAST(#{userIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(ur.user_id), '$')"
        + " ORDER BY r.created_at")
    List<java.util.Map<String, Object>> selectUserRoleRefs(@Param("userIds") List<String> userIds);

    /** 查询用户完整角色对象（对齐 Go fetchUserRoles：含 permissions JSON 列，me 响应用）。 */
    @Select("SELECT r.id, r.tenant_id, r.code, r.name, r.description,"
        + " r.permissions AS permissions, r.user_count, r.status, r.created_at"
        + " FROM user_roles ur JOIN roles r ON r.id = ur.role_id"
        + " WHERE ur.user_id = #{userId} ORDER BY r.created_at")
    List<java.util.Map<String, Object>> selectFullRolesByUser(@Param("userId") String userId);
}
