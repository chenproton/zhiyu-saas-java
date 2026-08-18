package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.system.SystemMajor;

/**
 * 专业 Mapper（majors 表）。
 *
 * @author zhiyu
 */
public interface SystemMajorMapper extends BaseMapperPlus<SystemMajor, SystemMajor> {

    @Insert("INSERT INTO majors (id, tenant_id, code, name, alias, enabled, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, #{alias}, #{enabled}, NOW(), NOW())")
    int insertMajor(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                    @Param("name") String name, @Param("alias") String alias, @Param("enabled") Boolean enabled);

    @Update("UPDATE majors SET code = #{code}, name = #{name}, alias = #{alias}, enabled = #{enabled}, updated_at = NOW()"
        + " WHERE id = #{id}")
    int updateMajor(@Param("id") String id, @Param("code") String code, @Param("name") String name,
                    @Param("alias") String alias, @Param("enabled") Boolean enabled);

    @Delete("DELETE FROM majors WHERE id = #{id}")
    int deleteMajor(@Param("id") String id);

    @Select("SELECT COUNT(*) FROM users WHERE major_id = #{majorId}")
    int countUserRefs(@Param("majorId") String majorId);
}
