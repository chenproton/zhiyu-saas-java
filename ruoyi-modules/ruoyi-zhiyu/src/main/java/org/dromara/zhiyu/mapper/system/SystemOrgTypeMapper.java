package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.system.SystemOrgType;

/**
 * 组织类型 Mapper（org_types 表）。
 *
 * @author zhiyu
 */
public interface SystemOrgTypeMapper extends BaseMapperPlus<SystemOrgType, SystemOrgType> {

    @Insert("INSERT INTO org_types (id, tenant_id, name, category, description)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{category}, #{description})")
    int insertOrgType(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                      @Param("category") String category, @Param("description") String description);

    @Update("UPDATE org_types SET name = #{name}, category = #{category}, description = #{description} WHERE id = #{id}")
    int updateOrgType(@Param("id") String id, @Param("name") String name, @Param("category") String category,
                      @Param("description") String description);

    @Delete("DELETE FROM org_types WHERE id = #{id}")
    int deleteOrgType(@Param("id") String id);

    @Select("SELECT COUNT(*) FROM organizations WHERE type_id = #{orgTypeId}")
    int countOrgRefs(@Param("orgTypeId") String orgTypeId);
}
