package org.dromara.zhiyu.mapper.portal;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.portal.PortalVenue;

/**
 * 场地 Mapper（venues 表）。
 *
 * @author zhiyu
 */
public interface PortalVenueMapper extends BaseMapperPlus<PortalVenue, PortalVenue> {

    /** 场地查重（对齐 Go store/imports.go ImportVenue）。 */
    @Select("SELECT id FROM venues WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String selectIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    /** 场地导入插入（对齐 Go store/imports.go ImportVenue）。 */
    @Insert("INSERT INTO venues (id, tenant_id, name, type, capacity)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{name}, #{type}, #{capacity})")
    int insertVenue(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                    @Param("type") String type, @Param("capacity") Integer capacity);
}
