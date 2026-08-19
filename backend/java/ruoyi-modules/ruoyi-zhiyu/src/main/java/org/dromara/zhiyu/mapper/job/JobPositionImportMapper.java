package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.Map;

/**
 * 岗位 Excel 导入 SQL（对齐 Go store/position_import_export.go + positions.go）。
 * 仅承载导入用 SQL；业务编排在 ImportExportServiceImpl.importPositions。
 *
 * @author zhiyu
 */
public interface JobPositionImportMapper {

    // ---------- 岗位查重 / 覆盖 ----------

    @Select("SELECT id::text AS id, created_by::text AS created_by, collaborators::text AS collaborators"
        + " FROM career_positions WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    Map<String, Object> findPositionByTenantAndName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id::text FROM career_positions WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String findPositionIdByTenantAndName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Update("UPDATE career_positions SET name = #{name}, short_name = #{shortName}, industry_id = #{industryId},"
        + " position_type = #{positionType}, salary_min = #{salaryMin}, salary_max = #{salaryMax},"
        + " description = #{description}, requirements = #{requirements}, career_path = #{careerPath},"
        + " batch_id = #{batchId} WHERE id = #{id}::uuid AND tenant_id = #{tenantId}::uuid")
    int updatePositionImportFields(@Param("id") String id, @Param("tenantId") String tenantId,
                                   @Param("name") String name, @Param("shortName") String shortName,
                                   @Param("industryId") String industryId, @Param("positionType") String positionType,
                                   @Param("salaryMin") Integer salaryMin, @Param("salaryMax") Integer salaryMax,
                                   @Param("description") String description, @Param("requirements") String requirements,
                                   @Param("careerPath") String careerPath, @Param("batchId") String batchId);

    @Delete("DELETE FROM career_position_majors WHERE career_position_id = #{positionId}::uuid")
    int deletePositionMajors(@Param("positionId") String positionId);

    @Delete("DELETE FROM position_certificates WHERE career_position_id = #{positionId}::uuid")
    int deletePositionCertificates(@Param("positionId") String positionId);

    @Delete("DELETE FROM position_responsibilities WHERE career_position_id = #{positionId}::uuid")
    int deletePositionResponsibilities(@Param("positionId") String positionId);

    @Delete("DELETE FROM position_ability_bindings WHERE career_position_id = #{positionId}::uuid")
    int deletePositionAbilityBindings(@Param("positionId") String positionId);

    @Delete("DELETE FROM ability_domains WHERE career_position_id = #{positionId}::uuid")
    int deleteAbilityDomains(@Param("positionId") String positionId);

    // ---------- 岗位关联写 ----------

    @Insert("INSERT INTO career_position_majors (id, career_position_id, major_id)"
        + " VALUES (#{id}, #{positionId}::uuid, #{majorId}::uuid) ON CONFLICT DO NOTHING")
    int insertPositionMajor(@Param("id") String id, @Param("positionId") String positionId,
                            @Param("majorId") String majorId);

    @Insert("INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{positionId}::uuid, #{certificateLibraryId}::uuid)"
        + " ON CONFLICT DO NOTHING")
    int insertPositionCertificate(@Param("id") String id, @Param("tenantId") String tenantId,
                                  @Param("positionId") String positionId,
                                  @Param("certificateLibraryId") String certificateLibraryId);

    @Insert("INSERT INTO career_positions (id, tenant_id, code, name, short_name, industry_id, position_type,"
        + " salary_min, salary_max, description, requirements, career_path, version, status, created_by, collaborators)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{code}, #{name}, #{shortName}, #{industryId}, #{positionType},"
        + " #{salaryMin}, #{salaryMax}, #{description}, #{requirements}, #{careerPath}, 'V1.0', 'draft', #{createdBy}::uuid, '{}')")
    int insertImportPosition(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                             @Param("name") String name, @Param("shortName") String shortName,
                             @Param("industryId") String industryId, @Param("positionType") String positionType,
                             @Param("salaryMin") Integer salaryMin, @Param("salaryMax") Integer salaryMax,
                             @Param("description") String description, @Param("requirements") String requirements,
                             @Param("careerPath") String careerPath, @Param("createdBy") String createdBy);

    @Update("UPDATE career_positions SET batch_id = #{batchId}::uuid WHERE id = #{positionId}::uuid")
    int updatePositionBatchId(@Param("batchId") String batchId, @Param("positionId") String positionId);

    @Insert("INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, sort_order)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{positionId}::uuid, #{name}, #{sortOrder}) ON CONFLICT DO NOTHING")
    int insertPositionResponsibility(@Param("id") String id, @Param("tenantId") String tenantId,
                                     @Param("positionId") String positionId, @Param("name") String name,
                                     @Param("sortOrder") Integer sortOrder);

    @Insert("INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, description, sort_order)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{positionId}::uuid, #{name}, #{description}, #{sortOrder})"
        + " ON CONFLICT DO NOTHING")
    int insertPositionResponsibilityFull(@Param("id") String id, @Param("tenantId") String tenantId,
                                         @Param("positionId") String positionId, @Param("name") String name,
                                         @Param("description") String description, @Param("sortOrder") Integer sortOrder);

    @Select("SELECT id::text FROM position_responsibilities WHERE career_position_id = #{positionId}::uuid"
        + " AND name = #{name} LIMIT 1")
    String findResponsibilityIdByPositionAndName(@Param("positionId") String positionId, @Param("name") String name);

    @Insert("INSERT INTO position_ability_bindings (id, tenant_id, career_position_id, responsibility_id,"
        + " ability_point_id, source, domain, required_level, rubric_description, weight, attributes)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{positionId}::uuid, #{responsibilityId}::uuid,"
        + " #{abilityPointId}::uuid, 'custom', #{domain}, #{requiredLevel}, #{rubricDescription}, 0, #{attributes})")
    int insertPositionAbilityBinding(@Param("id") String id, @Param("tenantId") String tenantId,
                                     @Param("positionId") String positionId,
                                     @Param("responsibilityId") String responsibilityId,
                                     @Param("abilityPointId") String abilityPointId,
                                     @Param("domain") String domain, @Param("requiredLevel") String requiredLevel,
                                     @Param("rubricDescription") String rubricDescription,
                                     @Param("attributes") String attributes);

    // ---------- 字典 find-or-create ----------

    @Select("SELECT id::text FROM industries WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String findIndustryIdByTenantAndName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id::text FROM certificate_library WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String findCertificateLibraryId(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO certificate_library (id, tenant_id, name) VALUES (#{id}, #{tenantId}::uuid, #{name})"
        + " ON CONFLICT DO NOTHING")
    int insertCertificateLibrary(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id::text FROM ability_points WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String findAbilityPointId(@Param("tenantId") String tenantId, @Param("name") String name);

    @Update("UPDATE ability_points SET attributes = #{attributes} WHERE id = #{id}::uuid"
        + " AND (attributes IS NULL OR attributes = '{}')")
    int updateAbilityPointAttributesIfEmpty(@Param("id") String id, @Param("attributes") String attributes);

    @Insert("INSERT INTO ability_points (id, tenant_id, name, is_public, attributes, code)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{name}, true, #{attributes}, #{code}) ON CONFLICT DO NOTHING")
    int insertAbilityPoint(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                           @Param("attributes") String attributes, @Param("code") String code);

    @Select("SELECT id::text FROM ability_domains WHERE tenant_id = #{tenantId}::uuid"
        + " AND career_position_id = #{positionId}::uuid AND name = #{name} LIMIT 1")
    String findAbilityDomainId(@Param("tenantId") String tenantId, @Param("positionId") String positionId,
                               @Param("name") String name);

    @Update("UPDATE ability_domains SET binding_ids = array_append(binding_ids, #{bindingId}::uuid)"
        + " WHERE id = #{domainId}::uuid AND NOT (#{bindingId}::uuid = ANY(binding_ids))")
    int appendAbilityDomainBinding(@Param("domainId") String domainId, @Param("bindingId") String bindingId);

    @Insert("INSERT INTO ability_domains (id, tenant_id, career_position_id, name, binding_ids)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{positionId}::uuid, #{name}, ARRAY[#{bindingId}::uuid])"
        + " ON CONFLICT DO NOTHING")
    int insertAbilityDomain(@Param("id") String id, @Param("tenantId") String tenantId,
                            @Param("positionId") String positionId, @Param("name") String name,
                            @Param("bindingId") String bindingId);

    @Select("SELECT id::text FROM batches WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String findBatchIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT EXISTS(SELECT 1 FROM career_positions WHERE tenant_id = #{tenantId}::uuid AND code = #{code})")
    boolean existsPositionCode(@Param("tenantId") String tenantId, @Param("code") String code);

    @Select("SELECT EXISTS(SELECT 1 FROM ability_points WHERE tenant_id = #{tenantId}::uuid AND code = #{code})")
    boolean existsAbilityPointCode(@Param("tenantId") String tenantId, @Param("code") String code);
}
