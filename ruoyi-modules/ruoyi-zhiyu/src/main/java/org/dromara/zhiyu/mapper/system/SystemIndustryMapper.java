package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.system.SystemIndustry;

/**
 * 行业 Mapper（industries 表）。
 *
 * @author zhiyu
 */
public interface SystemIndustryMapper extends BaseMapperPlus<SystemIndustry, SystemIndustry> {

    @Insert("INSERT INTO industries (id, tenant_id, code, name, parent_id, enabled, sort_order, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, #{parentId}, #{enabled}, #{sortOrder}, NOW(), NOW())")
    int insertIndustry(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                       @Param("name") String name, @Param("parentId") String parentId,
                       @Param("enabled") Boolean enabled, @Param("sortOrder") Integer sortOrder);

    @Update("UPDATE industries SET code = #{code}, name = #{name}, parent_id = #{parentId}, enabled = #{enabled},"
        + " sort_order = #{sortOrder}, updated_at = NOW() WHERE id = #{id}")
    int updateIndustry(@Param("id") String id, @Param("code") String code, @Param("name") String name,
                       @Param("parentId") String parentId, @Param("enabled") Boolean enabled,
                       @Param("sortOrder") Integer sortOrder);

    @Delete("DELETE FROM industries WHERE id = #{id}")
    int deleteIndustry(@Param("id") String id);

    @Select("SELECT COUNT(*) FROM industries WHERE parent_id = #{parentId}")
    int countChildren(@Param("parentId") String parentId);
}
