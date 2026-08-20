package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceEnterprise;

import java.util.List;

/**
 * 企业主体 Mapper（partner_enterprises 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface AllianceEnterpriseMapper extends BaseMapperPlus<AllianceEnterprise, AllianceEnterprise> {

    String COLS = "id, tenant_id, name, industry, region, description, logo_url, cover_image,"
        + " cooperation_types, contact_person, contact_phone, contact_email, address,"
        + " unified_social_credit_code, established_year, employee_count, business_license_photos,"
        + " qualification_photos, intellectual_property_photos, cover_photos, enable_public, created_at, updated_at";

    @Select("SELECT " + COLS + " FROM partner_enterprises WHERE id = #{id}")
    AllianceEnterprise selectByIdGlobal(@Param("id") String id);

    @Select("SELECT " + COLS + " FROM partner_enterprises WHERE tenant_id = #{tenantId}")
    AllianceEnterprise selectByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT " + COLS + " FROM partner_enterprises e"
        + " WHERE (#{keyword} = '' OR e.name LIKE CONCAT('%', #{keyword}, '%') OR e.industry LIKE CONCAT('%', #{keyword}, '%'))"
        + " AND NOT EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = e.id AND l.tenant_id = #{schoolTenantId})"
        + " ORDER BY e.created_at DESC LIMIT #{limit}")
    List<AllianceEnterprise> searchEnterprises(@Param("schoolTenantId") String schoolTenantId,
                                               @Param("keyword") String keyword,
                                               @Param("limit") int limit);

    @Insert("INSERT INTO partner_enterprises (id, tenant_id, name, industry, region, description, logo_url,"
        + " cover_image, cooperation_types, contact_person, contact_phone, contact_email, address,"
        + " unified_social_credit_code, established_year, employee_count, business_license_photos,"
        + " qualification_photos, intellectual_property_photos, cover_photos, enable_public, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{industry}, #{region}, #{description}, #{logoUrl},"
        + " #{coverImage}, CAST(#{cooperationTypes} AS JSON), #{contactPerson}, #{contactPhone}, #{contactEmail}, #{address},"
        + " #{unifiedSocialCreditCode}, #{establishedYear}, #{employeeCount}, CAST(#{businessLicensePhotos} AS JSON),"
        + " CAST(#{qualificationPhotos} AS JSON), CAST(#{intellectualPropertyPhotos} AS JSON), CAST(#{coverPhotos} AS JSON),"
        + " #{enablePublic}, NOW(), NOW())")
    int insertEnterprise(AllianceEnterprise e);

    // ---- 公开企业（门户前台） ----

    @Select("SELECT pe.id, pe.tenant_id, pe.name, pe.industry, pe.region, pe.description,"
        + " pe.logo_url, pe.cover_image, pe.cooperation_types, pe.contact_person, pe.contact_phone,"
        + " pe.contact_email, pe.address, pe.unified_social_credit_code, pe.established_year, pe.employee_count,"
        + " pe.business_license_photos, pe.qualification_photos, pe.intellectual_property_photos, pe.cover_photos,"
        + " pe.enable_public, pe.created_at, pe.updated_at, l.rating,"
        + " (SELECT COUNT(*) FROM alliance_projects p WHERE p.tenant_id = #{tenantId} AND p.is_public = true"
        + "   AND JSON_CONTAINS(p.enterprise_ids, JSON_QUOTE(pe.id), '$')) AS project_count,"
        + " (SELECT COUNT(*) FROM alliance_agreements a WHERE a.tenant_id = #{tenantId}"
        + "   AND JSON_CONTAINS(a.enterprise_ids, JSON_QUOTE(pe.id), '$')) AS agreement_count,"
        + " (SELECT COUNT(*) FROM alliance_achievements ac WHERE ac.tenant_id = #{tenantId} AND ac.is_public = true"
        + "   AND JSON_CONTAINS(ac.enterprise_ids, JSON_QUOTE(pe.id), '$')) AS achievement_count"
        + " FROM partner_enterprises pe"
        + " JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "   AND l.is_public = true AND l.status != 'terminated'"
        + " WHERE pe.enable_public = true ORDER BY pe.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<AllianceEnterprise> listPublicEnterprisesByTenant(@Param("tenantId") String tenantId,
                                                           @Param("limit") int limit,
                                                           @Param("offset") int offset);

    @Select("SELECT " + COLS + " FROM partner_enterprises pe WHERE pe.enable_public = true"
        + " ORDER BY pe.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<AllianceEnterprise> listPublicEnterprisesGlobal(@Param("limit") int limit,
                                                         @Param("offset") int offset);

    @Select("SELECT " + COLS + " FROM partner_enterprises pe"
        + " WHERE pe.id = #{id} AND pe.enable_public = true AND EXISTS ("
        + "   SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "   AND l.is_public = true AND l.status != 'terminated')")
    AllianceEnterprise selectPublicEnterpriseByTenant(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("SELECT " + COLS + " FROM partner_enterprises pe WHERE pe.id = #{id} AND pe.enable_public = true")
    AllianceEnterprise selectPublicEnterpriseGlobal(@Param("id") String id);
}
