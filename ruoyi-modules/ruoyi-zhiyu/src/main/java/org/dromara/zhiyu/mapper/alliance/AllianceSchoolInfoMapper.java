package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceSchoolInfo;

/**
 * 联盟学校信息 Mapper（alliance_school_info 表）。
 *
 * @author zhiyu
 */
public interface AllianceSchoolInfoMapper extends BaseMapperPlus<AllianceSchoolInfo, AllianceSchoolInfo> {

    @Select("SELECT id, tenant_id, name, short_name, school_type, province, city, address, website,"
        + " contact_phone, description, logo_url, scale_data, secondary_colleges, created_at, updated_at"
        + " FROM alliance_school_info WHERE tenant_id = #{tenantId}")
    AllianceSchoolInfo selectByTenant(@Param("tenantId") String tenantId);

    @Insert("INSERT INTO alliance_school_info (id, tenant_id, name, short_name, school_type, province, city,"
        + " address, website, contact_phone, description, logo_url, scale_data, secondary_colleges, created_at, updated_at)"
        + " VALUES (COALESCE(#{id}, (UUID())), #{tenantId}, #{name}, #{shortName}, #{schoolType}, #{province}, #{city},"
        + " #{address}, #{website}, #{contactPhone}, #{description}, #{logoUrl},"
        + " CAST(#{scaleData} AS JSON), CAST(#{secondaryColleges} AS JSON), NOW(), NOW())"
        + " ON DUPLICATE KEY UPDATE name = #{name}, short_name = #{shortName}, school_type = #{schoolType},"
        + " province = #{province}, city = #{city}, address = #{address}, website = #{website},"
        + " contact_phone = #{contactPhone}, description = #{description}, logo_url = #{logoUrl},"
        + " scale_data = CAST(#{scaleData} AS JSON), secondary_colleges = CAST(#{secondaryColleges} AS JSON), updated_at = NOW()")
    int upsertSchoolInfo(AllianceSchoolInfo info);
}
