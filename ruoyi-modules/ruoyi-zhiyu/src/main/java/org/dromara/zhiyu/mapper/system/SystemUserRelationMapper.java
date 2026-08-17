package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.system.SystemUserRelation;

import java.util.List;
import java.util.Map;

/**
 * 用户关系 Mapper（user_relations 表）。
 *
 * @author zhiyu
 */
public interface SystemUserRelationMapper extends BaseMapperPlus<SystemUserRelation, SystemUserRelation> {

    @Select("SELECT r.id, r.initiator_id, init_u.name AS initiator_name,"
        + " COALESCE(init_org.name, '') AS initiator_dept,"
        + " r.target_id, tgt_u.name AS target_name,"
        + " COALESCE(tgt_org.name, '') AS target_dept,"
        + " r.relation_type, r.created_at"
        + " FROM user_relations r"
        + " LEFT JOIN users init_u ON init_u.id = r.initiator_id"
        + " LEFT JOIN organizations init_org ON init_org.id = COALESCE(r.initiator_org_node_id, init_u.org_node_id)"
        + " LEFT JOIN users tgt_u ON tgt_u.id = r.target_id"
        + " LEFT JOIN organizations tgt_org ON tgt_org.id = COALESCE(r.target_org_node_id, tgt_u.org_node_id)"
        + " WHERE r.tenant_id = #{tenantId}"
        + " AND (#{search} = '' OR init_u.name ILIKE '%' || #{search} || '%' OR tgt_u.name ILIKE '%' || #{search} || '%')"
        + " ORDER BY r.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<Map<String, Object>> selectPage(@Param("tenantId") String tenantId, @Param("search") String search,
                                         @Param("limit") long limit, @Param("offset") long offset);

    @Select("SELECT COUNT(*) FROM user_relations r"
        + " LEFT JOIN users init_u ON init_u.id = r.initiator_id"
        + " LEFT JOIN users tgt_u ON tgt_u.id = r.target_id"
        + " WHERE r.tenant_id = #{tenantId}"
        + " AND (#{search} = '' OR init_u.name ILIKE '%' || #{search} || '%' OR tgt_u.name ILIKE '%' || #{search} || '%')")
    long count(@Param("tenantId") String tenantId, @Param("search") String search);

    @Select("SELECT initiator_id, target_id FROM user_relations WHERE id = #{id} AND tenant_id = #{tenantId}")
    Map<String, Object> selectIds(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("<script>SELECT COUNT(*) FROM users WHERE tenant_id = #{tenantId} AND id IN"
        + " <foreach collection='userIds' item='i' open='(' separator=',' close=')'>#{i}</foreach></script>")
    int countUsersInTenant(@Param("tenantId") String tenantId, @Param("userIds") List<String> userIds);

    @Insert("INSERT INTO user_relations (id, tenant_id, initiator_id, target_id, relation_type, description)"
        + " VALUES (#{id}, #{tenantId}, #{initiatorId}, #{targetId}, #{relationType}, #{description})")
    int insertRelation(@Param("id") String id, @Param("tenantId") String tenantId,
                       @Param("initiatorId") String initiatorId, @Param("targetId") String targetId,
                       @Param("relationType") String relationType, @Param("description") String description);

    @Delete("DELETE FROM user_relations WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteRelation(@Param("id") String id, @Param("tenantId") String tenantId);
}
