package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.system.SystemResourceCode;

/**
 * 资源编码 Mapper（resource_codes 表）。
 *
 * @author zhiyu
 */
public interface SystemResourceCodeMapper extends BaseMapperPlus<SystemResourceCode, SystemResourceCode> {

    @Insert("INSERT INTO resource_codes (id, tenant_id, code, name, description, type)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, #{description}, #{type})")
    int insertCode(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                   @Param("name") String name, @Param("description") String description, @Param("type") String type);

    @Update("UPDATE resource_codes SET name = #{name}, description = #{description}, type = #{type} WHERE id = #{id}")
    int updateCode(@Param("id") String id, @Param("name") String name, @Param("description") String description,
                   @Param("type") String type);

    @Delete("DELETE FROM resource_codes WHERE id = #{id}")
    int deleteCode(@Param("id") String id);
}
