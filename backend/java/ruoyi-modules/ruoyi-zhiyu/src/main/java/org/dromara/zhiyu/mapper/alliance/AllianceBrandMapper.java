package org.dromara.zhiyu.mapper.alliance;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceBrand;

import java.util.List;

/**
 * 品牌 Mapper（alliance_brands 表；含雇主/岗位/公开品牌视图 JOIN 查询）。
 *
 * @author zhiyu
 */
public interface AllianceBrandMapper extends BaseMapperPlus<AllianceBrand, AllianceBrand> {

    String BASE_COLS = "b.id, b.tenant_id, b.brand_type, b.name, b.status, b.is_public, b.is_featured,"
        + " b.cover_image, b.cover_video, b.description, b.data, b.student_id, b.enterprise_id, b.position_id,"
        + " b.major_id, b.teacher_id, b.expert_id, b.sort_order, b.view_count, b.created_at, b.updated_at";

    @Insert("INSERT INTO alliance_brands (id, tenant_id, brand_type, name, status, is_public, is_featured,"
        + " cover_image, cover_video, description, data, student_id, enterprise_id, position_id, major_id,"
        + " teacher_id, expert_id, sort_order, view_count, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{brandType}, #{name}, #{status}, #{isPublic}, #{isFeatured},"
        + " #{coverImage}, #{coverVideo}, #{description}, CAST(#{data} AS JSON), #{studentId}, #{enterpriseId},"
        + " #{positionId}, #{majorId}, #{teacherId}, #{expertId}, #{sortOrder}, #{viewCount}, NOW(), NOW())")
    int insertBrand(AllianceBrand b);

    @Update("UPDATE alliance_brands SET name = #{name}, status = #{status}, is_public = #{isPublic},"
        + " is_featured = #{isFeatured}, cover_image = #{coverImage}, cover_video = #{coverVideo},"
        + " description = #{description}, data = CAST(#{data} AS JSON), student_id = #{studentId},"
        + " enterprise_id = #{enterpriseId}, position_id = #{positionId}, major_id = #{majorId},"
        + " teacher_id = #{teacherId}, expert_id = #{expertId}, sort_order = #{sortOrder}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateBrand(AllianceBrand b);

    @Delete("DELETE FROM alliance_brands WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteBrand(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("SELECT id FROM alliance_brands WHERE tenant_id = #{tenantId} AND brand_type = #{brandType}"
        + " AND name = #{name} LIMIT 1")
    String selectBrandByName(@Param("tenantId") String tenantId, @Param("brandType") String brandType,
                             @Param("name") String name);

    @Update("UPDATE alliance_brands SET view_count = view_count + 1, updated_at = NOW() WHERE id = #{id}")
    int incrementView(@Param("id") String id);

    // ---- 雇主品牌（brandType=employer） ----

    @Data
    @EqualsAndHashCode(callSuper = true)
    class EmployerBrandRow extends AllianceBrand {
        private String enterpriseName;
        private String enterpriseLogo;
        private String enterpriseIndustry;
        private String enterpriseRegion;
        private String enterpriseDescription;
        private String enterpriseCreditCode;
        private String enterpriseContactPerson;
        private String enterpriseContactPhone;
        private String enterpriseContactEmail;
        private String enterpriseAddress;
        private Integer enterpriseEstablishedYear;
        private Integer enterpriseEmployeeCount;
        private String enterpriseCoverImage;
        private String enterpriseCoverPhotos;
        private String enterpriseBusinessLicensePhotos;
        private String enterpriseIntellectualPropertyPhotos;
        private String enterpriseQualificationPhotos;
    }

    String EMPLOYER_EXTRA = "pe.name AS enterprise_name, pe.logo_url AS enterprise_logo, pe.industry AS enterprise_industry,"
        + " pe.region AS enterprise_region, pe.description AS enterprise_description,"
        + " pe.unified_social_credit_code AS enterprise_credit_code, pe.contact_person AS enterprise_contact_person,"
        + " pe.contact_phone AS enterprise_contact_phone, pe.contact_email AS enterprise_contact_email,"
        + " pe.address AS enterprise_address, pe.established_year AS enterprise_established_year,"
        + " pe.employee_count AS enterprise_employee_count, pe.cover_image AS enterprise_cover_image,"
        + " pe.cover_photos AS enterprise_cover_photos, pe.business_license_photos AS enterprise_business_license_photos,"
        + " pe.intellectual_property_photos AS enterprise_intellectual_property_photos,"
        + " pe.qualification_photos AS enterprise_qualification_photos";

    @Select("<script>SELECT " + BASE_COLS + ", " + EMPLOYER_EXTRA
        + " FROM alliance_brands b LEFT JOIN partner_enterprises pe ON pe.id = b.enterprise_id"
        + " WHERE b.tenant_id = #{tenantId} AND b.brand_type = 'employer'"
        + " <if test='search != null and search != \"\"'> AND (b.name LIKE CONCAT('%', #{search}, '%') OR pe.name LIKE CONCAT('%', #{search}, '%'))</if>"
        + " ORDER BY b.sort_order ASC, b.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<EmployerBrandRow> listEmployerBrands(@Param("tenantId") String tenantId,
                                              @Param("search") String search,
                                              @Param("limit") int limit,
                                              @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM alliance_brands b LEFT JOIN partner_enterprises pe ON pe.id = b.enterprise_id"
        + " WHERE b.tenant_id = #{tenantId} AND b.brand_type = 'employer'"
        + " <if test='search != null and search != \"\"'> AND (b.name LIKE CONCAT('%', #{search}, '%') OR pe.name LIKE CONCAT('%', #{search}, '%'))</if></script>")
    long countEmployerBrands(@Param("tenantId") String tenantId, @Param("search") String search);

    @Select("SELECT " + BASE_COLS + ", " + EMPLOYER_EXTRA
        + " FROM alliance_brands b LEFT JOIN partner_enterprises pe ON pe.id = b.enterprise_id"
        + " WHERE b.id = #{id} AND b.tenant_id = #{tenantId}")
    EmployerBrandRow selectEmployerBrand(@Param("id") String id, @Param("tenantId") String tenantId);

    // ---- 岗位品牌（brandType=job） ----

    @Data
    @EqualsAndHashCode(callSuper = true)
    class JobBrandRow extends AllianceBrand {
        private String positionName;
        private String positionType;
        private Integer salaryMin;
        private Integer salaryMax;
        private String majorNames;
        private String positionStatus;
    }

    String JOB_EXTRA = "COALESCE(cp.name, '') AS position_name, COALESCE(cp.position_type, '') AS position_type,"
        + " cp.salary_min, cp.salary_max,"
        + " COALESCE(maj.major_names, JSON_ARRAY()) AS major_names, COALESCE(cp.status, '') AS position_status";

    @Select("<script>SELECT " + BASE_COLS + ", " + JOB_EXTRA
        + " FROM alliance_brands b LEFT JOIN career_positions cp ON cp.id = b.position_id"
        + " LEFT JOIN LATERAL (SELECT COALESCE(JSON_ARRAYAGG(m.name ORDER BY cpm.major_id), JSON_ARRAY()) AS major_names"
        + "   FROM career_position_majors cpm LEFT JOIN majors m ON m.id = cpm.major_id"
        + "   WHERE cpm.career_position_id = cp.id) maj ON true"
        + " WHERE b.tenant_id = #{tenantId} AND b.brand_type = 'job'"
        + " <if test='search != null and search != \"\"'> AND (b.name LIKE CONCAT('%', #{search}, '%') OR COALESCE(cp.name, '') LIKE CONCAT('%', #{search}, '%'))</if>"
        + " ORDER BY b.sort_order ASC, b.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<JobBrandRow> listJobBrands(@Param("tenantId") String tenantId,
                                    @Param("search") String search,
                                    @Param("limit") int limit,
                                    @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM alliance_brands b LEFT JOIN career_positions cp ON cp.id = b.position_id"
        + " WHERE b.tenant_id = #{tenantId} AND b.brand_type = 'job'"
        + " <if test='search != null and search != \"\"'> AND (b.name LIKE CONCAT('%', #{search}, '%') OR COALESCE(cp.name, '') LIKE CONCAT('%', #{search}, '%'))</if></script>")
    long countJobBrands(@Param("tenantId") String tenantId, @Param("search") String search);

    @Select("SELECT " + BASE_COLS + ", " + JOB_EXTRA
        + " FROM alliance_brands b LEFT JOIN career_positions cp ON cp.id = b.position_id"
        + " LEFT JOIN LATERAL (SELECT COALESCE(JSON_ARRAYAGG(m.name ORDER BY cpm.major_id), JSON_ARRAY()) AS major_names"
        + "   FROM career_position_majors cpm LEFT JOIN majors m ON m.id = cpm.major_id"
        + "   WHERE cpm.career_position_id = cp.id) maj ON true"
        + " WHERE b.id = #{id} AND b.tenant_id = #{tenantId}")
    JobBrandRow selectJobBrand(@Param("id") String id, @Param("tenantId") String tenantId);

    // ---- 公开品牌（门户前台） ----

    @Data
    @EqualsAndHashCode(callSuper = true)
    class PublicBrandRow extends AllianceBrand {
        private String enterpriseName;
        private String enterpriseLogo;
        private String enterpriseIndustry;
        private String enterpriseRegion;
        private String enterpriseDescription;
        private String enterpriseCreditCode;
        private String enterpriseContactPerson;
        private String enterpriseContactPhone;
        private String enterpriseContactEmail;
        private String enterpriseAddress;
        private Integer enterpriseEstablishedYear;
        private Integer enterpriseEmployeeCount;
        private String enterpriseCoverImage;
        private String enterpriseCoverPhotos;
        private String enterpriseBusinessLicensePhotos;
        private String enterpriseIntellectualPropertyPhotos;
        private String enterpriseQualificationPhotos;
        private String positionName;
        private String positionType;
        private Integer salaryMin;
        private Integer salaryMax;
        private String majorNames;
        private String industryName;
        private String positionStatus;
        private String positionDescription;
        private String positionRequirements;
        private String positionCareerPath;
        private String positionCoverImage;
        private String responsibilities;
        private String certificates;
        private String personName;
        private String personAvatar;
        private String personTitle;
        private String personPosition;
        private String personOrganization;
        private String personIndustry;
        private Integer personExperienceYears;
        private String personEducation;
        private String personIntroduction;
        private String personWorkExperience;
        private String personCity;
        private String personExpertType;
        private String personRating;
        private String personStatus;
        private String personGender;
        private Integer personAge;
        private String personSpecialties;
        private String personProfessionalFields;
        private String personAttachments;
    }

    String PUBLIC_EXTRA = EMPLOYER_EXTRA + ","
        + " COALESCE(cp.name, '') AS position_name, COALESCE(cp.position_type, '') AS position_type,"
        + " cp.salary_min, cp.salary_max, COALESCE(maj.major_names, JSON_ARRAY()) AS major_names,"
        + " ind.name AS industry_name, COALESCE(cp.status, '') AS position_status, cp.description AS position_description,"
        + " COALESCE(cp.requirements, JSON_ARRAY()) AS position_requirements, cp.career_path AS position_career_path,"
        + " cp.cover_image AS position_cover_image,"
        + " COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', r.id, 'careerPositionId', r.career_position_id,"
        + "   'name', r.name, 'description', r.description, 'sortOrder', r.sort_order) ORDER BY r.sort_order)"
        + "   FROM position_responsibilities r WHERE r.career_position_id = cp.id), '[]') AS responsibilities,"
        + " COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pc.id, 'careerPositionId', pc.career_position_id,"
        + "   'certificateLibraryId', pc.certificate_library_id, 'name', cl.name, 'url', cl.url,"
        + "   'description', cl.description, 'imageUrl', cl.image_url) ORDER BY cl.name)"
        + "   FROM position_certificates pc JOIN certificate_library cl ON cl.id = pc.certificate_library_id"
        + "   WHERE pc.career_position_id = cp.id), '[]') AS certificates,"
        + " COALESCE(ae.name, u.name, '') AS person_name, COALESCE(ae.avatar_url, u.avatar_url, '') AS person_avatar,"
        + " ae.title AS person_title, ae.position AS person_position,"
        + " COALESCE(ae.organization, org.name, '') AS person_organization, ae.industry AS person_industry,"
        + " ae.experience_years AS person_experience_years, ae.education AS person_education,"
        + " ae.introduction AS person_introduction, ae.work_experience AS person_work_experience, ae.city AS person_city,"
        + " ae.expert_type AS person_expert_type, ae.rating AS person_rating, ae.status AS person_status,"
        + " ae.gender AS person_gender, ae.age AS person_age,"
        + " COALESCE(ae.specialties, '[]') AS person_specialties,"
        + " COALESCE(ae.professional_fields, '[]') AS person_professional_fields,"
        + " COALESCE(ae.attachments, '[]') AS person_attachments";

    String PUBLIC_FROM = "alliance_brands b"
        + " LEFT JOIN partner_enterprises pe ON pe.id = b.enterprise_id"
        + " LEFT JOIN career_positions cp ON cp.id = b.position_id"
        + " LEFT JOIN LATERAL (SELECT COALESCE(JSON_ARRAYAGG(m.name ORDER BY cpm.major_id), JSON_ARRAY()) AS major_names"
        + "   FROM career_position_majors cpm LEFT JOIN majors m ON m.id = cpm.major_id"
        + "   WHERE cpm.career_position_id = cp.id) maj ON true"
        + " LEFT JOIN industries ind ON ind.id = cp.industry_id"
        + " LEFT JOIN users u ON u.id = b.teacher_id"
        + " LEFT JOIN organizations org ON org.id = u.org_node_id"
        + " LEFT JOIN alliance_experts ae ON"
        + "   (b.teacher_id IS NOT NULL AND ae.user_id = b.teacher_id AND ae.tenant_id = b.tenant_id AND ae.enterprise_id IS NULL)"
        + "   OR (b.expert_id IS NOT NULL AND ae.id = b.expert_id AND ae.tenant_id = b.tenant_id)";

    @Select("<script>SELECT " + BASE_COLS + ", " + PUBLIC_EXTRA + " FROM " + PUBLIC_FROM
        + " WHERE b.is_public = true AND b.status != 'archived'"
        + " <if test='tenantId != null and tenantId != \"\"'> AND b.tenant_id = #{tenantId}</if>"
        + " <if test='brandType != null and brandType != \"\"'> AND b.brand_type = #{brandType}</if>"
        + " ORDER BY b.is_featured DESC, b.sort_order ASC, b.created_at DESC LIMIT 100</script>")
    List<PublicBrandRow> listPublicBrands(@Param("tenantId") String tenantId, @Param("brandType") String brandType);

    @Select("<script>SELECT " + BASE_COLS + ", " + PUBLIC_EXTRA + " FROM " + PUBLIC_FROM
        + " WHERE b.id = #{id} AND b.is_public = true AND b.status != 'archived'"
        + " <if test='tenantId != null and tenantId != \"\"'> AND b.tenant_id = #{tenantId}</if></script>")
    PublicBrandRow selectPublicBrand(@Param("id") String id, @Param("tenantId") String tenantId);
}
