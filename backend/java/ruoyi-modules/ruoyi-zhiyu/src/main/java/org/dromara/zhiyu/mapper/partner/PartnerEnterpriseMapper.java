package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.partner.PartnerEnterprise;

import java.util.List;

/**
 * 企业主体 Mapper（partner_enterprises 表，Go→Java 迁移）。
 *
 * <p>读取走 MyBatis-Plus 内置 selectById/selectList（jsonb 列经
 * JsonStringListTypeHandler 映射）；写入走自定义 SQL（jsonb 需显式 CAST）。</p>
 *
 * @author zhiyu
 */
public interface PartnerEnterpriseMapper extends BaseMapperPlus<PartnerEnterprise, PartnerEnterprise> {

    /**
     * 新建企业主体（企业自助注册用；jsonb 数组列显式 CAST，对齐 Go CreateEnterprise）。
     */
    @Insert("INSERT INTO partner_enterprises (id, tenant_id, name, cooperation_types, contact_person, contact_phone,"
        + " contact_email, unified_social_credit_code, business_license_photos, qualification_photos,"
        + " intellectual_property_photos, cover_photos, enable_public, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{name},"
        + " CAST(#{cooperationTypes, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " #{contactPerson}, #{contactPhone}, #{contactEmail}, #{unifiedSocialCreditCode},"
        + " CAST(#{businessLicensePhotos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " CAST(#{qualificationPhotos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " CAST(#{intellectualPropertyPhotos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " CAST(#{coverPhotos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " #{enablePublic}, NOW(), NOW())")
    int insertEnterprise(PartnerEnterprise e);

    /**
     * 更新企业主体信息（部分更新语义由 Service 先合并再调用；对齐 Go UpdateEnterpriseProfile）。
     */
    @Update("UPDATE partner_enterprises SET"
        + " name = #{name}, industry = #{industry}, region = #{region}, description = #{description},"
        + " logo_url = #{logoUrl}, cover_image = #{coverImage},"
        + " cooperation_types = CAST(#{cooperationTypes, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " contact_person = #{contactPerson}, contact_phone = #{contactPhone}, contact_email = #{contactEmail},"
        + " address = #{address}, unified_social_credit_code = #{unifiedSocialCreditCode},"
        + " established_year = #{establishedYear}, employee_count = #{employeeCount},"
        + " business_license_photos = CAST(#{businessLicensePhotos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " qualification_photos = CAST(#{qualificationPhotos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " intellectual_property_photos = CAST(#{intellectualPropertyPhotos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " cover_photos = CAST(#{coverPhotos, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS jsonb),"
        + " enable_public = #{enablePublic}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateProfile(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                      @Param("industry") String industry, @Param("region") String region,
                      @Param("description") String description, @Param("logoUrl") String logoUrl,
                      @Param("coverImage") String coverImage, @Param("cooperationTypes") List<String> cooperationTypes,
                      @Param("contactPerson") String contactPerson, @Param("contactPhone") String contactPhone,
                      @Param("contactEmail") String contactEmail, @Param("address") String address,
                      @Param("unifiedSocialCreditCode") String unifiedSocialCreditCode,
                      @Param("establishedYear") Integer establishedYear, @Param("employeeCount") Integer employeeCount,
                      @Param("businessLicensePhotos") List<String> businessLicensePhotos,
                      @Param("qualificationPhotos") List<String> qualificationPhotos,
                      @Param("intellectualPropertyPhotos") List<String> intellectualPropertyPhotos,
                      @Param("coverPhotos") List<String> coverPhotos, @Param("enablePublic") Boolean enablePublic);

    /**
     * 回写租户同名同值字段（名称/联系人/电话/企业代码），保证超管端与前台看到同一份数据。
     */
    @Update("UPDATE tenants SET name = #{name}, contact = #{contactPerson}, phone = #{contactPhone},"
        + " enterprise_code = #{unifiedSocialCreditCode}, updated_at = NOW() WHERE id = #{tenantId}")
    int syncTenantFields(@Param("tenantId") String tenantId, @Param("name") String name,
                         @Param("contactPerson") String contactPerson, @Param("contactPhone") String contactPhone,
                         @Param("unifiedSocialCreditCode") String unifiedSocialCreditCode);
}
