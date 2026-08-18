package org.dromara.zhiyu.mapper.alliance;

import lombok.Data;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceEnterpriseLink;

import java.util.List;

/**
 * 学校-企业合作关联 Mapper（alliance_enterprise_links 表）。
 *
 * @author zhiyu
 */
public interface AllianceEnterpriseLinkMapper extends BaseMapperPlus<AllianceEnterpriseLink, AllianceEnterpriseLink> {

    @Insert("INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, relation_type, status, rating,"
        + " enterprise_type, is_public, secondary_colleges, created_by, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{enterpriseId}, #{relationType}, #{status}, #{rating},"
        + " #{enterpriseType}, #{isPublic}, CAST(#{secondaryColleges} AS jsonb), #{createdBy}, NOW(), NOW())")
    int insertLink(AllianceEnterpriseLink l);

    @Delete("DELETE FROM alliance_enterprise_links WHERE enterprise_id = #{enterpriseId} AND tenant_id = #{tenantId}")
    int deleteLink(@Param("enterpriseId") String enterpriseId, @Param("tenantId") String tenantId);

    @Update("UPDATE alliance_enterprise_links SET status = #{status}, rating = #{rating}, enterprise_type = #{enterpriseType},"
        + " is_public = #{isPublic}, secondary_colleges = CAST(#{secondaryColleges} AS jsonb), updated_at = NOW()"
        + " WHERE enterprise_id = #{enterpriseId} AND tenant_id = #{tenantId}")
    int updateLink(@Param("enterpriseId") String enterpriseId, @Param("tenantId") String tenantId,
                   @Param("status") String status, @Param("rating") String rating,
                   @Param("enterpriseType") String enterpriseType, @Param("isPublic") boolean isPublic,
                   @Param("secondaryColleges") String secondaryColleges);

    @Select("SELECT enterprise_id FROM alliance_enterprise_links WHERE tenant_id = #{tenantId}")
    List<String> listEnterpriseIdsBySchoolTenant(@Param("tenantId") String tenantId);

    @Select("SELECT id, tenant_id, enterprise_id, relation_type, status, rating, enterprise_type, is_public,"
        + " secondary_colleges, created_by, created_at, updated_at"
        + " FROM alliance_enterprise_links WHERE enterprise_id = #{enterpriseId} AND tenant_id = #{tenantId}")
    AllianceEnterpriseLink selectLinkByEnterprise(@Param("enterpriseId") String enterpriseId,
                                                  @Param("tenantId") String tenantId);

    /** 学校侧已引入企业合并视图行（企业主体 + link 管理字段）。 */
    @Data
    class LinkedEnterpriseRow {
        private String id;
        private String tenantId;
        private String name;
        private String industry;
        private String region;
        private String description;
        private String logoUrl;
        private String coverImage;
        private String cooperationTypes;
        private String contactPerson;
        private String contactPhone;
        private String contactEmail;
        private String address;
        private String unifiedSocialCreditCode;
        private Integer establishedYear;
        private Integer employeeCount;
        private String businessLicensePhotos;
        private String qualificationPhotos;
        private String intellectualPropertyPhotos;
        private String coverPhotos;
        private Boolean enablePublic;
        private java.time.OffsetDateTime createdAt;
        private java.time.OffsetDateTime updatedAt;
        private String linkId;
        private String relationType;
        private String status;
        private String rating;
        private String enterpriseType;
        private Boolean isPublic;
        private String secondaryColleges;
    }

    @Select("<script>"
        + "SELECT e.id, e.tenant_id, e.name, e.industry, e.region, e.description, e.logo_url, e.cover_image,"
        + " e.cooperation_types, e.contact_person, e.contact_phone, e.contact_email, e.address,"
        + " e.unified_social_credit_code, e.established_year, e.employee_count, e.business_license_photos,"
        + " e.qualification_photos, e.intellectual_property_photos, e.cover_photos, e.enable_public,"
        + " e.created_at, e.updated_at, l.id AS link_id, l.relation_type, l.status, l.rating, l.enterprise_type,"
        + " l.is_public, l.secondary_colleges"
        + " FROM alliance_enterprise_links l JOIN partner_enterprises e ON e.id = l.enterprise_id"
        + " WHERE l.tenant_id = #{tenantId}"
        + " <if test='search != null and search != \"\"'> AND (e.name ILIKE '%' || #{search} || '%' OR e.industry ILIKE '%' || #{search} || '%')</if>"
        + " <if test='status != null and status != \"\"'> AND l.status = #{status}</if>"
        + " ORDER BY l.created_at DESC LIMIT #{limit} OFFSET #{offset}"
        + "</script>")
    List<LinkedEnterpriseRow> listBySchoolTenant(@Param("tenantId") String tenantId,
                                                 @Param("search") String search,
                                                 @Param("status") String status,
                                                 @Param("limit") int limit,
                                                 @Param("offset") int offset);

    @Select("<script>"
        + "SELECT COUNT(*) FROM alliance_enterprise_links l JOIN partner_enterprises e ON e.id = l.enterprise_id"
        + " WHERE l.tenant_id = #{tenantId}"
        + " <if test='search != null and search != \"\"'> AND (e.name ILIKE '%' || #{search} || '%' OR e.industry ILIKE '%' || #{search} || '%')</if>"
        + " <if test='status != null and status != \"\"'> AND l.status = #{status}</if>"
        + "</script>")
    long countBySchoolTenant(@Param("tenantId") String tenantId,
                             @Param("search") String search,
                             @Param("status") String status);

    @Select("SELECT e.id, e.tenant_id, e.name, e.industry, e.region, e.description, e.logo_url, e.cover_image,"
        + " e.cooperation_types, e.contact_person, e.contact_phone, e.contact_email, e.address,"
        + " e.unified_social_credit_code, e.established_year, e.employee_count, e.business_license_photos,"
        + " e.qualification_photos, e.intellectual_property_photos, e.cover_photos, e.enable_public,"
        + " e.created_at, e.updated_at, l.id AS link_id, l.relation_type, l.status, l.rating, l.enterprise_type,"
        + " l.is_public, l.secondary_colleges"
        + " FROM alliance_enterprise_links l JOIN partner_enterprises e ON e.id = l.enterprise_id"
        + " WHERE l.enterprise_id = #{enterpriseId} AND l.tenant_id = #{tenantId}")
    LinkedEnterpriseRow selectLinkedByEnterprise(@Param("enterpriseId") String enterpriseId,
                                                 @Param("tenantId") String tenantId);
}
