package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.system.SystemOrganization;

import java.util.List;
import java.util.Map;

/**
 * 组织 Mapper（organizations 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface SystemOrganizationMapper extends BaseMapperPlus<SystemOrganization, SystemOrganization> {

    /** 收集组织及其全部后代 ID（递归 CTE，限定租户）。 */
    @Select("WITH RECURSIVE subtree AS ("
        + " SELECT id, parent_id FROM organizations WHERE id = #{id} AND tenant_id = #{tenantId}"
        + " UNION ALL"
        + " SELECT o.id, o.parent_id FROM organizations o JOIN subtree s ON o.parent_id = s.id WHERE o.tenant_id = #{tenantId}"
        + ") SELECT id FROM subtree")
    List<String> subtreeIds(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 判断 candidateId 是否是 id 的后代（防环）。 */
    @Select("SELECT EXISTS(WITH RECURSIVE subtree AS ("
        + " SELECT id, parent_id FROM organizations WHERE id = #{id}"
        + " UNION ALL"
        + " SELECT o.id, o.parent_id FROM organizations o JOIN subtree s ON o.parent_id = s.id"
        + ") SELECT 1 FROM subtree WHERE id = #{candidateId})")
    boolean isDescendant(@Param("id") String id, @Param("candidateId") String candidateId);

    /** 校验组织类型归属。 */
    @Select("SELECT EXISTS(SELECT 1 FROM org_types WHERE id = #{typeId} AND tenant_id = #{tenantId})")
    boolean orgTypeExists(@Param("typeId") String typeId, @Param("tenantId") String tenantId);

    /** 统计每个组织的直接成员数。 */
    @Select("SELECT org_node_id, COUNT(*) FROM users WHERE org_node_id IS NOT NULL AND tenant_id = #{tenantId} GROUP BY org_node_id")
    List<Map<String, Object>> memberCounts(@Param("tenantId") String tenantId);

    /** 创建组织。 */
    @Insert("INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order, member_count)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{typeId}, #{parentId}, #{sortOrder}, 0)")
    int insertOrg(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                  @Param("typeId") String typeId, @Param("parentId") String parentId, @Param("sortOrder") Integer sortOrder);

    /** 更新组织。 */
    @Update("UPDATE organizations SET name = #{name}, type_id = #{typeId}, parent_id = #{parentId},"
        + " sort_order = #{sortOrder}, updated_at = NOW() WHERE id = #{id}")
    int updateOrg(@Param("id") String id, @Param("name") String name, @Param("typeId") String typeId,
                  @Param("parentId") String parentId, @Param("sortOrder") Integer sortOrder);

    /** 删除组织子树时解绑用户。 */
    @Update("<script>UPDATE users SET org_node_id = NULL, updated_at = NOW()"
        + " WHERE org_node_id IN"
        + " <foreach collection='ids' item='i' open='(' separator=',' close=')'>#{i}</foreach>"
        + " AND tenant_id = #{tenantId}</script>")
    int unbindUsers(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);

    /** 删除组织子树（限定租户）。 */
    @Update("<script>DELETE FROM organizations WHERE id IN"
        + " <foreach collection='ids' item='i' open='(' separator=',' close=')'>#{i}</foreach>"
        + " AND tenant_id = #{tenantId}</script>")
    int deleteSubtree(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);
}
