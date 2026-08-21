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
        + " VALUES (#{tenantId}, #{enterpriseId}, #{resourceType}, JSON_ARRAY(#{resourceId}), #{createdBy})"
        + " ON DUPLICATE KEY UPDATE"
        + " resource_ids = ("
        + "   SELECT COALESCE(JSON_ARRAYAGG(DISTINCT x), JSON_ARRAY())"
        + "   FROM ("
        + "     SELECT j.x FROM JSON_TABLE(resource_ids, '$[*]' COLUMNS (x CHAR(36) PATH '$')) j"
        + "     UNION"
        + "     SELECT j.x FROM JSON_TABLE(VALUES(resource_ids), '$[*]' COLUMNS (x CHAR(36) PATH '$')) j"
        + "   ) u"
        + " ), created_by = VALUES(created_by), updated_at = NOW()")
    int addResourceId(@Param("tenantId") String tenantId, @Param("enterpriseId") String enterpriseId,
                      @Param("resourceType") String resourceType, @Param("resourceId") String resourceId,
                      @Param("createdBy") String createdBy);

    /**
     * 查询企业是否被授权某资源；返回授权记录所属租户（防跨租户授权污染），未授权返回 null。
     */
    @Select("SELECT tenant_id FROM alliance_resource_grants"
        + " WHERE enterprise_id = #{enterpriseId} AND resource_type = #{resourceType}"
        + " AND JSON_CONTAINS(resource_ids, JSON_QUOTE(#{resourceId}), '$') LIMIT 1")
    String selectGrantTenantId(@Param("enterpriseId") String enterpriseId, @Param("resourceType") String resourceType,
                               @Param("resourceId") String resourceId);

    /**
     * 从全部授权记录中移除资源 id（资源删除时清理孤儿引用）。
     */
    @Delete("UPDATE alliance_resource_grants SET resource_ids = JSON_REMOVE(resource_ids, JSON_UNQUOTE(JSON_SEARCH(resource_ids, 'one', #{resourceId}))),"
        + " updated_at = NOW() WHERE resource_type = #{resourceType}"
        + " AND JSON_CONTAINS(resource_ids, JSON_QUOTE(#{resourceId}), '$')")
    int removeResourceId(@Param("resourceType") String resourceType, @Param("resourceId") String resourceId);

    /** 删除授权集合被清空的整行。 */
    @Delete("DELETE FROM alliance_resource_grants WHERE resource_type = #{resourceType} AND JSON_LENGTH(resource_ids) = 0")
    int deleteEmptyGrants(@Param("resourceType") String resourceType);
}
