package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.partner.PartnerExpert;

import java.util.List;

/**
 * 企业专家 Mapper（alliance_experts 表，Go→Java 迁移）。
 *
 * <p>读取走 MyBatis-Plus 内置方法（jsonb 列经 JsonStringListTypeHandler 映射）；
 * 写入走自定义 SQL（jsonb 需显式 CAST）。</p>
 *
 * @author zhiyu
 */
public interface PartnerExpertMapper extends BaseMapperPlus<PartnerExpert, PartnerExpert> {

    /**
     * 创建专家（对齐 Go AllianceStore.CreateExpert；jsonb 字段 COALESCE 兜底 '[]'）。
     */
    @Insert("INSERT INTO alliance_experts (id, tenant_id, name, gender, age, title, position, expert_type,"
        + " industry, professional_fields, specialties, experience_years, education, introduction,"
        + " work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id,"
        + " organization, rating, status, partner_source, position_direction, secondary_colleges,"
        + " is_public, user_id, created_by)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{gender}, #{age}, #{title}, #{position}, #{expertType},"
        + " #{industry},"
        + " COALESCE(CAST(#{professionalFields, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " COALESCE(CAST(#{specialties, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " #{experienceYears}, #{education}, #{introduction}, #{workExperience}, #{city}, #{avatarUrl}, #{coverImage},"
        + " COALESCE(CAST(#{photos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " COALESCE(CAST(#{attachments, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " #{enterpriseId}, #{organization}, #{rating}, #{status}, #{partnerSource}, #{positionDirection},"
        + " COALESCE(CAST(#{secondaryColleges, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " COALESCE(#{isPublic}, false), #{userId}, #{createdBy})")
    int insertExpert(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                     @Param("gender") String gender, @Param("age") Integer age, @Param("title") String title,
                     @Param("position") String position, @Param("expertType") String expertType,
                     @Param("industry") String industry, @Param("professionalFields") List<String> professionalFields,
                     @Param("specialties") List<String> specialties, @Param("experienceYears") Integer experienceYears,
                     @Param("education") String education, @Param("introduction") String introduction,
                     @Param("workExperience") String workExperience, @Param("city") String city,
                     @Param("avatarUrl") String avatarUrl, @Param("coverImage") String coverImage,
                     @Param("photos") List<String> photos, @Param("attachments") List<String> attachments,
                     @Param("enterpriseId") String enterpriseId, @Param("organization") String organization,
                     @Param("rating") String rating, @Param("status") String status,
                     @Param("partnerSource") String partnerSource, @Param("positionDirection") String positionDirection,
                     @Param("secondaryColleges") List<String> secondaryColleges, @Param("isPublic") Boolean isPublic,
                     @Param("userId") String userId, @Param("createdBy") String createdBy);

    /**
     * 更新专家（对齐 Go AllianceStore.UpdateExpert；企业归属 tenant 条件 SQL 层纵深防御）。
     */
    @Update("UPDATE alliance_experts SET"
        + " name = #{name}, gender = #{gender}, age = #{age}, title = #{title}, position = #{position},"
        + " expert_type = #{expertType}, industry = #{industry},"
        + " professional_fields = COALESCE(CAST(#{professionalFields, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " specialties = COALESCE(CAST(#{specialties, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " experience_years = #{experienceYears}, education = #{education}, introduction = #{introduction},"
        + " work_experience = #{workExperience}, city = #{city}, avatar_url = #{avatarUrl}, cover_image = #{coverImage},"
        + " photos = COALESCE(CAST(#{photos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " attachments = COALESCE(CAST(#{attachments, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " enterprise_id = #{enterpriseId}, organization = #{organization}, rating = #{rating}, status = #{status},"
        + " partner_source = #{partnerSource}, position_direction = #{positionDirection},"
        + " secondary_colleges = COALESCE(CAST(#{secondaryColleges, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " is_public = COALESCE(#{isPublic}, false), user_id = #{userId}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateExpert(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                     @Param("gender") String gender, @Param("age") Integer age, @Param("title") String title,
                     @Param("position") String position, @Param("expertType") String expertType,
                     @Param("industry") String industry, @Param("professionalFields") List<String> professionalFields,
                     @Param("specialties") List<String> specialties, @Param("experienceYears") Integer experienceYears,
                     @Param("education") String education, @Param("introduction") String introduction,
                     @Param("workExperience") String workExperience, @Param("city") String city,
                     @Param("avatarUrl") String avatarUrl, @Param("coverImage") String coverImage,
                     @Param("photos") List<String> photos, @Param("attachments") List<String> attachments,
                     @Param("enterpriseId") String enterpriseId, @Param("organization") String organization,
                     @Param("rating") String rating, @Param("status") String status,
                     @Param("partnerSource") String partnerSource, @Param("positionDirection") String positionDirection,
                     @Param("secondaryColleges") List<String> secondaryColleges, @Param("isPublic") Boolean isPublic,
                     @Param("userId") String userId);

    /**
     * 删除专家（限本租户）。
     */
    @Delete("DELETE FROM alliance_experts WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteExpert(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 从评审步骤评审人数组中移除该账号（数组列无 FK，防悬空引用）。 */
    @Update("UPDATE task_review_steps SET assigned_user_ids = JSON_REMOVE(assigned_user_ids, JSON_UNQUOTE(JSON_SEARCH(assigned_user_ids, 'one', #{userId})))"
        + " WHERE JSON_CONTAINS(assigned_user_ids, JSON_QUOTE(#{userId}), '$')")
    int removeExpertFromReviewSteps(@Param("userId") String userId);

    /** 删除专家账号的用户角色。 */
    @Delete("DELETE FROM user_roles WHERE user_id = #{userId}")
    int deleteUserRoles(@Param("userId") String userId);

    /** 删除专家账号的用户本体。 */
    @Delete("DELETE FROM users WHERE id = #{userId}")
    int deleteUser(@Param("userId") String userId);

    /** 按租户+角色 code 查询角色 ID。 */
    @Select("SELECT id FROM roles WHERE tenant_id = #{tenantId} AND code = #{code} LIMIT 1")
    String selectRoleIdByCode(@Param("tenantId") String tenantId, @Param("code") String code);

    /** 绑定用户角色。 */
    @Insert("INSERT INTO user_roles (id, user_id, role_id) VALUES (#{id}, #{userId}, #{roleId})"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertUserRole(@Param("id") String id, @Param("userId") String userId, @Param("roleId") String roleId);

    /** 角色用户数累加。 */
    @Update("UPDATE roles SET user_count = user_count + 1 WHERE id = #{roleId}")
    int incrementRoleUserCount(@Param("roleId") String roleId);
}
