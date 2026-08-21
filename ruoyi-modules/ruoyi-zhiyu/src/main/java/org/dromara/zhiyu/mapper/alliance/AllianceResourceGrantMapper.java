package org.dromara.zhiyu.mapper.alliance;

import lombok.Data;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceResourceGrant;

import java.util.List;

/**
 * 学校-企业资源授权 Mapper（alliance_resource_grants 表；resource_ids 为 MySQL JSON 数组列，原 PG uuid[]）。
 *
 * @author zhiyu
 */
public interface AllianceResourceGrantMapper extends BaseMapperPlus<AllianceResourceGrant, AllianceResourceGrant> {

    String GRANT_COLS = "id, tenant_id, enterprise_id, resource_type, resource_ids, created_by, created_at, updated_at";

    @Select("SELECT " + GRANT_COLS + " FROM alliance_resource_grants"
        + " WHERE tenant_id = #{tenantId} AND enterprise_id = #{enterpriseId} ORDER BY resource_type")
    List<AllianceResourceGrant> listBySchool(@Param("tenantId") String tenantId,
                                             @Param("enterpriseId") String enterpriseId);

    @Delete("DELETE FROM alliance_resource_grants WHERE tenant_id = #{tenantId} AND enterprise_id = #{enterpriseId}"
        + " AND resource_type = #{resourceType}")
    int clearGrant(@Param("tenantId") String tenantId, @Param("enterpriseId") String enterpriseId,
                   @Param("resourceType") String resourceType);

    @Insert("INSERT INTO alliance_resource_grants (tenant_id, enterprise_id, resource_type, resource_ids, created_by)"
        + " VALUES (#{tenantId}, #{enterpriseId}, #{resourceType}, #{resourceIds}, #{createdBy})"
        + " ON DUPLICATE KEY UPDATE resource_ids = VALUES(resource_ids), created_by = VALUES(created_by), updated_at = NOW()")
    int upsertGrant(@Param("tenantId") String tenantId, @Param("enterpriseId") String enterpriseId,
                    @Param("resourceType") String resourceType, @Param("resourceIds") String resourceIds,
                    @Param("createdBy") String createdBy);

    @Select("SELECT COUNT(*) FROM career_positions WHERE JSON_CONTAINS(CAST(REPLACE(REPLACE(#{ids}, '{', '['), '}', ']') AS JSON), JSON_QUOTE(id), '$') AND tenant_id = #{tenantId}")
    int countPositionsOwned(@Param("tenantId") String tenantId, @Param("ids") String ids);

    @Select("SELECT COUNT(*) FROM scenarios WHERE JSON_CONTAINS(CAST(REPLACE(REPLACE(#{ids}, '{', '['), '}', ']') AS JSON), JSON_QUOTE(id), '$') AND tenant_id = #{tenantId}")
    int countScenesOwned(@Param("tenantId") String tenantId, @Param("ids") String ids);

    @Select("SELECT id FROM career_positions WHERE source_enterprise_id = #{enterpriseId} AND status != 'archived'")
    List<String> listCoBuiltPositions(@Param("enterpriseId") String enterpriseId);

    @Select("SELECT id FROM scenarios WHERE source_enterprise_id = #{enterpriseId} AND status != 'archived'")
    List<String> listCoBuiltScenes(@Param("enterpriseId") String enterpriseId);

    @Data
    class GrantResourceOptionRow {
        private String id;
        private String name;
        private String type;
        private String source;
        private String sourceEnterpriseId;
        private String sourceEnterpriseName;
        private String status;
        private String batchId;
        private String batchName;
    }

    @Select("SELECT cp.id AS id, cp.name, 'position' AS type,"
        + " CASE WHEN cp.source_enterprise_id IS NULL THEN 'school' ELSE 'enterprise' END AS source,"
        + " cp.source_enterprise_id, pe.name AS source_enterprise_name, cp.status, cp.batch_id, b.name AS batch_name"
        + " FROM career_positions cp LEFT JOIN partner_enterprises pe ON pe.id = cp.source_enterprise_id"
        + " LEFT JOIN batches b ON b.id = cp.batch_id WHERE cp.tenant_id = #{tenantId}"
        + " UNION ALL"
        + " SELECT s.id AS id, s.name, 'scene' AS type,"
        + " CASE WHEN s.source_enterprise_id IS NULL THEN 'school' ELSE 'enterprise' END AS source,"
        + " s.source_enterprise_id, pe.name AS source_enterprise_name, s.status, s.batch_id, sb.name AS batch_name"
        + " FROM scenarios s LEFT JOIN partner_enterprises pe ON pe.id = s.source_enterprise_id"
        + " LEFT JOIN scene_batches sb ON sb.id = s.batch_id WHERE s.tenant_id = #{tenantId}"
        + " ORDER BY type, name")
    List<GrantResourceOptionRow> listResourceOptions(@Param("tenantId") String tenantId);
}
