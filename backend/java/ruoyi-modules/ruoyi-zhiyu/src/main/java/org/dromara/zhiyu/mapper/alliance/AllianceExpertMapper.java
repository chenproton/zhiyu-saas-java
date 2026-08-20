package org.dromara.zhiyu.mapper.alliance;

import lombok.Data;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceExpert;

import java.util.List;

/**
 * 专家 Mapper（alliance_experts 表）。
 *
 * @author zhiyu
 */
public interface AllianceExpertMapper extends BaseMapperPlus<AllianceExpert, AllianceExpert> {

    @Insert("INSERT INTO alliance_experts (id, tenant_id, name, gender, age, title, position, expert_type, industry,"
        + " professional_fields, specialties, experience_years, education, introduction, work_experience, city,"
        + " avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating, status, partner_source,"
        + " position_direction, secondary_colleges, is_public, user_id, created_by, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{gender}, #{age}, #{title}, #{position}, #{expertType}, #{industry},"
        + " CAST(#{professionalFields} AS JSON), CAST(#{specialties} AS JSON), #{experienceYears}, #{education},"
        + " #{introduction}, #{workExperience}, #{city}, #{avatarUrl}, #{coverImage}, CAST(#{photos} AS JSON),"
        + " CAST(#{attachments} AS JSON), #{enterpriseId}, #{organization}, #{rating}, #{status}, #{partnerSource},"
        + " #{positionDirection}, CAST(#{secondaryColleges} AS JSON), #{isPublic}, #{userId}, #{createdBy}, NOW(), NOW())")
    int insertExpert(AllianceExpert e);

    @Update("UPDATE alliance_experts SET name = #{name}, gender = #{gender}, age = #{age}, title = #{title},"
        + " position = #{position}, expert_type = #{expertType}, industry = #{industry},"
        + " professional_fields = CAST(#{professionalFields} AS JSON), specialties = CAST(#{specialties} AS JSON),"
        + " experience_years = #{experienceYears}, education = #{education}, introduction = #{introduction},"
        + " work_experience = #{workExperience}, city = #{city}, avatar_url = #{avatarUrl}, cover_image = #{coverImage},"
        + " photos = CAST(#{photos} AS JSON), attachments = CAST(#{attachments} AS JSON), enterprise_id = #{enterpriseId},"
        + " organization = #{organization}, rating = #{rating}, status = #{status}, partner_source = #{partnerSource},"
        + " position_direction = #{positionDirection}, secondary_colleges = CAST(#{secondaryColleges} AS JSON),"
        + " is_public = #{isPublic}, user_id = #{userId}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateExpert(AllianceExpert e);

    @Delete("DELETE FROM alliance_experts WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteExpert(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("SELECT * FROM alliance_experts WHERE id = #{id}")
    AllianceExpert selectByIdGlobal(@Param("id") String id);

    @Select("SELECT * FROM alliance_experts WHERE tenant_id = #{tenantId} AND user_id = #{userId}")
    AllianceExpert selectByUserId(@Param("tenantId") String tenantId, @Param("userId") String userId);

    @Update("UPDATE alliance_experts SET is_public = #{isPublic}, updated_at = NOW() WHERE id = #{id} AND EXISTS ("
        + " SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = alliance_experts.enterprise_id"
        + " AND l.tenant_id = #{tenantId} AND l.status != 'terminated')")
    int updateIsPublic(@Param("id") String id, @Param("tenantId") String tenantId, @Param("isPublic") boolean isPublic);

    @Select("<script>"
        + "SELECT x.* FROM alliance_experts x"
        + " WHERE JSON_CONTAINS(CAST(REPLACE(REPLACE(#{enterpriseIds}, '{', '['), '}', ']') AS JSON), JSON_QUOTE(x.enterprise_id), '$')"
        + " AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id"
        + "   AND l.tenant_id = #{tenantId} AND l.status != 'terminated')"
        + " <if test='search != null and search != \"\"'> AND (x.name LIKE CONCAT('%', #{search}, '%') OR x.title LIKE CONCAT('%', #{search}, '%') OR x.industry LIKE CONCAT('%', #{search}, '%'))</if>"
        + " <if test='status != null and status != \"\"'> AND x.status = #{status}</if>"
        + " ORDER BY x.created_at DESC LIMIT #{limit} OFFSET #{offset}"
        + "</script>")
    List<AllianceExpert> listByEnterpriseIds(@Param("tenantId") String tenantId,
                                             @Param("enterpriseIds") String enterpriseIds,
                                             @Param("search") String search,
                                             @Param("status") String status,
                                             @Param("limit") int limit,
                                             @Param("offset") int offset);

    @Select("<script>"
        + "SELECT COUNT(*) FROM alliance_experts x"
        + " WHERE JSON_CONTAINS(CAST(REPLACE(REPLACE(#{enterpriseIds}, '{', '['), '}', ']') AS JSON), JSON_QUOTE(x.enterprise_id), '$')"
        + " AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id"
        + "   AND l.tenant_id = #{tenantId} AND l.status != 'terminated')"
        + " <if test='search != null and search != \"\"'> AND (x.name LIKE CONCAT('%', #{search}, '%') OR x.title LIKE CONCAT('%', #{search}, '%') OR x.industry LIKE CONCAT('%', #{search}, '%'))</if>"
        + " <if test='status != null and status != \"\"'> AND x.status = #{status}</if>"
        + "</script>")
    long countByEnterpriseIds(@Param("tenantId") String tenantId,
                              @Param("enterpriseIds") String enterpriseIds,
                              @Param("search") String search,
                              @Param("status") String status);

    @Select("<script>"
        + "SELECT x.*, pe.name AS enterprise_name FROM alliance_experts x"
        + " JOIN partner_enterprises pe ON pe.id = x.enterprise_id"
        + " WHERE " + "<choose><when test='includeNonPublic'>true</when><otherwise>x.is_public = true</otherwise></choose>"
        + " AND x.status = 'active' AND pe.enable_public = true"
        + " AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id"
        + "   AND l.tenant_id = #{tenantId} AND l.is_public = true AND l.status != 'terminated')"
        + " ORDER BY x.created_at DESC LIMIT #{limit} OFFSET #{offset}"
        + "</script>")
    List<AllianceExpert> listPublicExpertsByTenant(@Param("tenantId") String tenantId,
                                                   @Param("limit") int limit,
                                                   @Param("offset") int offset,
                                                   @Param("includeNonPublic") boolean includeNonPublic);

    @Select("<script>"
        + "SELECT x.*, pe.name AS enterprise_name FROM alliance_experts x"
        + " JOIN partner_enterprises pe ON pe.id = x.enterprise_id"
        + " WHERE " + "<choose><when test='includeNonPublic'>true</when><otherwise>x.is_public = true</otherwise></choose>"
        + " AND x.status = 'active' AND pe.enable_public = true"
        + " ORDER BY x.created_at DESC LIMIT #{limit} OFFSET #{offset}"
        + "</script>")
    List<AllianceExpert> listPublicExpertsGlobal(@Param("limit") int limit,
                                                 @Param("offset") int offset,
                                                 @Param("includeNonPublic") boolean includeNonPublic);

    @Select("SELECT x.*, pe.name AS enterprise_name FROM alliance_experts x"
        + " JOIN partner_enterprises pe ON pe.id = x.enterprise_id"
        + " WHERE x.id = #{id} AND x.is_public = true AND x.status = 'active' AND pe.enable_public = true"
        + " AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id"
        + "   AND l.tenant_id = #{tenantId} AND l.is_public = true AND l.status != 'terminated')")
    AllianceExpert selectPublicExpertByTenant(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("SELECT x.*, pe.name AS enterprise_name FROM alliance_experts x"
        + " JOIN partner_enterprises pe ON pe.id = x.enterprise_id"
        + " WHERE x.id = #{id} AND x.is_public = true AND x.status = 'active' AND pe.enable_public = true")
    AllianceExpert selectPublicExpertGlobal(@Param("id") String id);

    @Data
    class MentorOptionRow {
        private String expertId;
        private String name;
        private String title;
        private String enterpriseId;
        private String enterpriseName;
        private String userId;
    }

    @Select("SELECT x.id AS expert_id, x.name, x.title, e.id AS enterprise_id, e.name AS enterprise_name, x.user_id"
        + " FROM alliance_experts x"
        + " JOIN alliance_enterprise_links l ON l.enterprise_id = x.enterprise_id AND l.tenant_id = #{tenantId}"
        + " JOIN partner_enterprises e ON e.id = x.enterprise_id"
        + " ORDER BY e.name, x.created_at DESC")
    List<MentorOptionRow> listMentorOptions(@Param("tenantId") String tenantId);
}
