package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.AdminEnterpriseProfile;

/**
 * 企业主体 Mapper（partner_enterprises 表，超管代租户维护用）。
 *
 * @author zhiyu
 */
public interface SystemEnterpriseMapper {

    @Select("SELECT id, tenant_id, name, unified_social_credit_code, contact_person, contact_phone,"
        + " contact_email, address, description, enable_public"
        + " FROM partner_enterprises WHERE tenant_id = #{tenantId} LIMIT 1")
    AdminEnterpriseProfile selectByTenant(@Param("tenantId") String tenantId);

    @Insert("INSERT INTO partner_enterprises (id, tenant_id, name, unified_social_credit_code, contact_person,"
        + " contact_phone, contact_email, enable_public)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{unifiedSocialCreditCode}, #{contactPerson}, #{contactPhone},"
        + " #{contactEmail}, #{enablePublic})")
    int insertEnterprise(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                         @Param("unifiedSocialCreditCode") String unifiedSocialCreditCode,
                         @Param("contactPerson") String contactPerson, @Param("contactPhone") String contactPhone,
                         @Param("contactEmail") String contactEmail, @Param("enablePublic") Boolean enablePublic);

    @Update("UPDATE partner_enterprises SET name = #{name}, unified_social_credit_code = #{unifiedSocialCreditCode},"
        + " contact_person = #{contactPerson}, contact_phone = #{contactPhone}, contact_email = #{contactEmail},"
        + " enable_public = #{enablePublic}, updated_at = NOW() WHERE id = #{id}")
    int updateEnterprise(@Param("id") String id, @Param("name") String name,
                         @Param("unifiedSocialCreditCode") String unifiedSocialCreditCode,
                         @Param("contactPerson") String contactPerson, @Param("contactPhone") String contactPhone,
                         @Param("contactEmail") String contactEmail, @Param("enablePublic") Boolean enablePublic);
}
