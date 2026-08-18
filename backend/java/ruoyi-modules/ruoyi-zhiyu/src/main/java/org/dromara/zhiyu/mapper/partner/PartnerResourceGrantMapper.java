package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.partner.PartnerResourceGrant;

/**
 * 资源授权 Mapper（alliance_resource_grants 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface PartnerResourceGrantMapper extends BaseMapperPlus<PartnerResourceGrant, PartnerResourceGrant> {

    /**
     * 追加资源授权（幂等合并，对齐 Go AddResourceID）。
     */
    @Update("INSERT INTO alliance_resource_grants (tenant_id, enterprise_id, resource_type, resource_ids, created_by)"
        + " VALUES (#{tenantId}, #{enterpriseId}, #{resourceType}, ARRAY[#{resourceId}]::uuid[], #{createdBy})"
        + " ON CONFLICT (tenant_id, enterprise_id, resource_type)"
        + " DO UPDATE SET resource_ids = ("
        + "   SELECT array_agg(DISTINCT x)"
        + "   FROM unnest(alliance_resource_grants.resource_ids || EXCLUDED.resource_ids) AS x"
        + " ), created_by = EXCLUDED.created_by, updated_at = NOW()")
    int addResourceId(@Param("tenantId") String tenantId, @Param("enterpriseId") String enterpriseId,
                      @Param("resourceType") String resourceType, @Param("resourceId") String resourceId,
                      @Param("createdBy") String createdBy);

    /**
     * 查询企业是否被授权某资源；返回授权记录所属租户（防跨租户授权污染），未授权返回 null。
     */
    @Select("SELECT tenant_id::text FROM alliance_resource_grants"
        + " WHERE enterprise_id = #{enterpriseId} AND resource_type = #{resourceType}"
        + " AND #{resourceId}::uuid = ANY(resource_ids) LIMIT 1")
    String selectGrantTenantId(@Param("enterpriseId") String enterpriseId, @Param("resourceType") String resourceType,
                               @Param("resourceId") String resourceId);

    /**
     * 从全部授权记录中移除资源 id（资源删除时清理孤儿引用）。
     */
    @Delete("UPDATE alliance_resource_grants SET resource_ids = array_remove(resource_ids, #{resourceId}::uuid),"
        + " updated_at = NOW() WHERE resource_type = #{resourceType} AND #{resourceId}::uuid = ANY(resource_ids)")
    int removeResourceId(@Param("resourceType") String resourceType, @Param("resourceId") String resourceId);

    /** 删除授权集合被清空的整行。 */
    @Delete("DELETE FROM alliance_resource_grants WHERE resource_type = #{resourceType} AND cardinality(resource_ids) = 0")
    int deleteEmptyGrants(@Param("resourceType") String resourceType);
}
