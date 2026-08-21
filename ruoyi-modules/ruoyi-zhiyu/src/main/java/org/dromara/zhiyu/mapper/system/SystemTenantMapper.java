package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ZhiyuTenant;

import java.util.List;
import java.util.Map;

/**
 * 租户 Mapper（tenants 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface SystemTenantMapper extends BaseMapperPlus<ZhiyuTenant, ZhiyuTenant> {

    @Select("SELECT EXISTS(SELECT 1 FROM tenants WHERE code = #{code})")
    boolean existsCode(@Param("code") String code);

    @Select("SELECT EXISTS(SELECT 1 FROM users WHERE login_name = #{loginName})")
    boolean existsLoginName(@Param("loginName") String loginName);

    @Insert("INSERT INTO tenants (id, name, code, type, logo_url, domain, enterprise_code, contact, phone, address,"
        + " description, valid_from, valid_until, status)"
        + " VALUES (#{id}, #{name}, #{code}, #{type}, #{logoUrl}, #{domain}, #{enterpriseCode}, #{contact}, #{phone},"
        + " #{address}, #{description}, CAST(NULLIF(#{validFrom}, '') AS date), CAST(NULLIF(#{validUntil}, '') AS date), 'active')")
    int insertTenant(@Param("id") String id, @Param("name") String name, @Param("code") String code,
                     @Param("type") String type, @Param("logoUrl") String logoUrl, @Param("domain") String domain,
                     @Param("enterpriseCode") String enterpriseCode, @Param("contact") String contact,
                     @Param("phone") String phone, @Param("address") String address,
                     @Param("description") String description, @Param("validFrom") String validFrom,
                     @Param("validUntil") String validUntil);

    @Update("UPDATE tenants SET name = #{name}, logo_url = COALESCE(#{logoUrl}, logo_url),"
        + " domain = COALESCE(#{domain}, domain), enterprise_code = COALESCE(#{enterpriseCode}, enterprise_code),"
        + " contact = COALESCE(#{contact}, contact), phone = COALESCE(#{phone}, phone),"
        + " address = COALESCE(#{address}, address), description = COALESCE(#{description}, description),"
        + " short_name = COALESCE(#{shortName}, short_name), school_type = COALESCE(#{schoolType}, school_type),"
        + " province = COALESCE(NULLIF(#{province}, ''), province), city = COALESCE(NULLIF(#{city}, ''), city),"
        + " website = COALESCE(#{website}, website), contact_phone = COALESCE(#{contactPhone}, contact_phone),"
        + " scale_data = COALESCE(#{scaleData, typeHandler=org.dromara.zhiyu.core.mybatis.JsonMapTypeHandler}, scale_data),"
        + " secondary_colleges = COALESCE(#{secondaryColleges, typeHandler=org.dromara.zhiyu.core.mybatis.JsonArrayTypeHandler}, secondary_colleges),"
        + " education_level = COALESCE(#{educationLevel}, education_level), education_nature = COALESCE(#{educationNature}, education_nature),"
        + " valid_from = COALESCE(CAST(NULLIF(#{validFrom}, '') AS date), valid_from),"
        + " valid_until = COALESCE(CAST(NULLIF(#{validUntil}, '') AS date), valid_until), updated_at = NOW()"
        + " WHERE id = #{id}")
    int updateTenant(@Param("id") String id, @Param("name") String name, @Param("logoUrl") String logoUrl,
                     @Param("domain") String domain, @Param("enterpriseCode") String enterpriseCode,
                     @Param("contact") String contact, @Param("phone") String phone, @Param("address") String address,
                     @Param("description") String description, @Param("shortName") String shortName,
                     @Param("schoolType") String schoolType, @Param("province") String province,
                     @Param("city") String city, @Param("website") String website,
                     @Param("contactPhone") String contactPhone, @Param("scaleData") Map<String, Object> scaleData,
                     @Param("secondaryColleges") List<Object> secondaryColleges,
                     @Param("educationLevel") String educationLevel, @Param("educationNature") String educationNature,
                     @Param("validFrom") String validFrom, @Param("validUntil") String validUntil);

    @Update("UPDATE tenants SET status = #{status}, updated_at = NOW() WHERE id = #{id}")
    int updateStatus(@Param("id") String id, @Param("status") String status);

    @Update("UPDATE tenants SET admin_ids = #{adminIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} WHERE id = #{id}")
    int updateAdminIds(@Param("id") String id, @Param("adminIds") List<String> adminIds);

    @Delete("DELETE FROM users WHERE tenant_id = #{tenantId}")
    int deleteTenantUsers(@Param("tenantId") String tenantId);

    @Delete("DELETE FROM tenants WHERE id = #{tenantId}")
    int deleteTenant(@Param("tenantId") String tenantId);
}
