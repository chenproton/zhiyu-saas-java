package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;
import org.dromara.zhiyu.domain.ZhiyuUser;

import java.util.List;

/**
 * 用户管理 Mapper（users 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface SystemUserMapper extends BaseMapperPlus<ZhiyuUser, ZhiyuUser> {

    @Select("SELECT id, tenant_id, institution_id, org_node_id, major_id, role, platform, login_name, username,"
        + " name, email, phone, avatar_url, student_no, work_id, id_card, title_ids, status, graduate_year,"
        + " last_login_at, created_at, updated_at FROM users WHERE id = #{id} AND tenant_id = #{tenantId}")
    @Results({
        @Result(column = "title_ids", property = "titleIds", typeHandler = JsonStringArrayTypeHandler.class)
    })
    ZhiyuUser selectUserByIdAndTenant(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 按租户过滤用户 ID 列表（batchDelete 防跨租户 IDOR：仅返回当前租户真实存在的用户）。 */
    @Select("SELECT id FROM users WHERE tenant_id = #{tenantId}"
        + " AND JSON_CONTAINS(CAST(#{userIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(id), '$')")
    List<String> filterTenantUserIds(@Param("tenantId") String tenantId, @Param("userIds") List<String> userIds);

    @Insert("INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id, role, platform, login_name,"
        + " username, password_hash, name, email, phone, avatar_url, student_no, work_id, id_card, title_ids, oauth, status)"
        + " VALUES (#{id}, #{tenantId}, #{institutionId}, #{orgNodeId}, #{majorId}, #{role}, #{platform}, #{globalLoginName},"
        + " #{username}, #{passwordHash}, #{name}, #{email}, #{phone}, #{avatarUrl}, #{studentNo}, #{workId}, #{idCard},"
        + " COALESCE(#{titleIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler}, JSON_ARRAY()), '{}', 'active')")
    int insertUser(@Param("id") String id, @Param("tenantId") String tenantId, @Param("institutionId") String institutionId,
                   @Param("orgNodeId") String orgNodeId, @Param("majorId") String majorId, @Param("role") String role,
                   @Param("platform") String platform, @Param("globalLoginName") String globalLoginName,
                   @Param("username") String username, @Param("passwordHash") String passwordHash,
                   @Param("name") String name, @Param("email") String email, @Param("phone") String phone,
                   @Param("avatarUrl") String avatarUrl, @Param("studentNo") String studentNo,
                   @Param("workId") String workId, @Param("idCard") String idCard,
                   @Param("titleIds") List<String> titleIds);

    @Update("UPDATE users SET institution_id = COALESCE(#{institutionId}, institution_id),"
        + " org_node_id = COALESCE(#{orgNodeId}, org_node_id), major_id = COALESCE(#{majorId}, major_id),"
        + " role = #{role}, login_name = #{globalLoginName}, username = #{username}, name = #{name},"
        + " email = COALESCE(#{email}, email), phone = COALESCE(#{phone}, phone),"
        + " avatar_url = COALESCE(#{avatarUrl}, avatar_url), student_no = COALESCE(#{studentNo}, student_no),"
        + " work_id = COALESCE(#{workId}, work_id), id_card = COALESCE(#{idCard}, id_card),"
        + " title_ids = COALESCE(#{titleIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler}, title_ids),"
        + " updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateUser(@Param("id") String id, @Param("tenantId") String tenantId, @Param("institutionId") String institutionId,
                   @Param("orgNodeId") String orgNodeId, @Param("majorId") String majorId, @Param("role") String role,
                   @Param("globalLoginName") String globalLoginName, @Param("username") String username,
                   @Param("name") String name, @Param("email") String email, @Param("phone") String phone,
                   @Param("avatarUrl") String avatarUrl, @Param("studentNo") String studentNo,
                   @Param("workId") String workId, @Param("idCard") String idCard,
                   @Param("titleIds") List<String> titleIds);

    @Update("UPDATE users SET name = #{name}, updated_at = NOW() WHERE id = #{id}")
    int updateSelfName(@Param("id") String id, @Param("name") String name);

    @Update("UPDATE users SET status = #{status}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateStatus(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);

    @Update("UPDATE users SET password_hash = #{passwordHash}, password_changed_at = NOW(), updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int resetPassword(@Param("id") String id, @Param("tenantId") String tenantId, @Param("passwordHash") String passwordHash);

    @Delete("DELETE FROM users WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteUser(@Param("id") String id, @Param("tenantId") String tenantId);

    @Update("UPDATE users SET status = 'graduated', graduate_year = #{graduateYear}, updated_at = NOW()"
        + " WHERE JSON_CONTAINS(CAST(#{userIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(id), '$')"
        + " AND tenant_id = #{tenantId} AND status = 'active'")
    int batchGraduate(@Param("tenantId") String tenantId, @Param("userIds") List<String> userIds,
                      @Param("graduateYear") Integer graduateYear);

    @Delete("DELETE FROM users WHERE JSON_CONTAINS(CAST(#{userIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(id), '$')"
        + " AND tenant_id = #{tenantId}")
    int batchDeleteUsers(@Param("tenantId") String tenantId, @Param("userIds") List<String> userIds);

    @Update("UPDATE users SET org_node_id = #{orgNodeId}, updated_at = NOW()"
        + " WHERE JSON_CONTAINS(CAST(#{userIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(id), '$')"
        + " AND tenant_id = #{tenantId}")
    int batchUpdateOrgNode(@Param("tenantId") String tenantId, @Param("userIds") List<String> userIds,
                           @Param("orgNodeId") String orgNodeId);

    @Select("SELECT EXISTS(SELECT 1 FROM organizations WHERE id = #{orgNodeId} AND tenant_id = #{tenantId})")
    boolean orgNodeExists(@Param("orgNodeId") String orgNodeId, @Param("tenantId") String tenantId);

    @Select("SELECT EXISTS(SELECT 1 FROM majors WHERE id = #{majorId} AND tenant_id = #{tenantId})")
    boolean majorExists(@Param("majorId") String majorId, @Param("tenantId") String tenantId);

    @Select("<script>SELECT COUNT(*) FROM roles WHERE id IN"
        + " <foreach collection='roleIds' item='i' open='(' separator=',' close=')'>#{i}</foreach>"
        + " AND tenant_id = #{tenantId}</script>")
    int countRolesInTenant(@Param("tenantId") String tenantId, @Param("roleIds") List<String> roleIds);

    /** 用户列表（动态过滤 + 租户隔离；roleId/roleCode 用 EXISTS，orgNodeId 用递归子树）。 */
    @Select("<script>SELECT id, tenant_id, institution_id, org_node_id, major_id, role, platform, login_name,"
        + " username, name, email, phone, avatar_url, student_no, work_id, id_card, title_ids, status, graduate_year,"
        + " last_login_at, created_at, updated_at FROM users"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test='institutionId != null and institutionId != \"\"'> AND institution_id = #{institutionId}</if>"
        + " <if test='roleId != null and roleId != \"\"'> AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = users.id AND ur.role_id = #{roleId})</if>"
        + " <if test='roleCode != null and roleCode != \"\"'> AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id WHERE ur.user_id = users.id AND r2.code = #{roleCode})</if>"
        + " <if test='orgNodeId != null and orgNodeId != \"\"'> AND org_node_id IN (WITH RECURSIVE org_subtree AS (SELECT id FROM organizations WHERE id = #{orgNodeId} UNION ALL SELECT o.id FROM organizations o JOIN org_subtree st ON o.parent_id = st.id) SELECT id FROM org_subtree)</if>"
        + " <if test='titleId != null and titleId != \"\"'> AND title_ids @&gt; JSON_ARRAY(#{titleId})</if>"
        + " <if test='status != null and status != \"\"'> AND status = #{status}</if>"
        + " <if test='search != null and search != \"\"'> AND (username LIKE CONCAT('%', #{search}, '%') OR name LIKE CONCAT('%', #{search}, '%') OR email LIKE CONCAT('%', #{search}, '%'))</if>"
        + " ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    @Results({
        @Result(column = "title_ids", property = "titleIds", typeHandler = JsonStringArrayTypeHandler.class)
    })
    List<ZhiyuUser> selectUserPage(@Param("tenantId") String tenantId, @Param("institutionId") String institutionId,
                                   @Param("roleId") String roleId, @Param("roleCode") String roleCode,
                                   @Param("orgNodeId") String orgNodeId, @Param("titleId") String titleId,
                                   @Param("status") String status, @Param("search") String search,
                                   @Param("limit") long limit, @Param("offset") long offset);

    @Select("<script>SELECT COUNT(*) FROM users WHERE tenant_id = #{tenantId}"
        + " <if test='institutionId != null and institutionId != \"\"'> AND institution_id = #{institutionId}</if>"
        + " <if test='roleId != null and roleId != \"\"'> AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = users.id AND ur.role_id = #{roleId})</if>"
        + " <if test='roleCode != null and roleCode != \"\"'> AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id WHERE ur.user_id = users.id AND r2.code = #{roleCode})</if>"
        + " <if test='orgNodeId != null and orgNodeId != \"\"'> AND org_node_id IN (WITH RECURSIVE org_subtree AS (SELECT id FROM organizations WHERE id = #{orgNodeId} UNION ALL SELECT o.id FROM organizations o JOIN org_subtree st ON o.parent_id = st.id) SELECT id FROM org_subtree)</if>"
        + " <if test='titleId != null and titleId != \"\"'> AND title_ids @&gt; JSON_ARRAY(#{titleId})</if>"
        + " <if test='status != null and status != \"\"'> AND status = #{status}</if>"
        + " <if test='search != null and search != \"\"'> AND (username LIKE CONCAT('%', #{search}, '%') OR name LIKE CONCAT('%', #{search}, '%') OR email LIKE CONCAT('%', #{search}, '%'))</if>"
        + "</script>")
    long countUsers(@Param("tenantId") String tenantId, @Param("institutionId") String institutionId,
                    @Param("roleId") String roleId, @Param("roleCode") String roleCode,
                    @Param("orgNodeId") String orgNodeId, @Param("titleId") String titleId,
                    @Param("status") String status, @Param("search") String search);
}
