package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.domain.system.SystemUserExtensionField;

import java.util.List;

/**
 * 用户扩展字段 Mapper（user_extension_fields 表）。
 *
 * @author zhiyu
 */
public interface SystemUserExtensionFieldMapper extends BaseMapperPlus<SystemUserExtensionField, SystemUserExtensionField> {

    @Select("SELECT id, tenant_id, field_key, field_name, field_type, is_enabled, is_required,"
        + " applicable_role_codes, slot_number, created_at FROM user_extension_fields"
        + " WHERE tenant_id = #{tenantId} ORDER BY slot_number ASC")
    @Results({
        @Result(column = "applicable_role_codes", property = "applicableRoleCodes", typeHandler = PgArrayTypeHandler.class)
    })
    List<SystemUserExtensionField> selectByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT id, tenant_id, field_key, field_name, field_type, is_enabled, is_required,"
        + " applicable_role_codes, slot_number, created_at FROM user_extension_fields"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    @Results({
        @Result(column = "applicable_role_codes", property = "applicableRoleCodes", typeHandler = PgArrayTypeHandler.class)
    })
    SystemUserExtensionField selectByIdAndTenant(@Param("id") String id, @Param("tenantId") String tenantId);

    @Update("UPDATE user_extension_fields SET field_name = #{fieldName}, is_enabled = #{isEnabled},"
        + " is_required = #{isRequired}, applicable_role_codes = CAST(#{applicableRoleCodes, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS text[])"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateField(@Param("id") String id, @Param("tenantId") String tenantId, @Param("fieldName") String fieldName,
                    @Param("isEnabled") Boolean isEnabled, @Param("isRequired") Boolean isRequired,
                    @Param("applicableRoleCodes") List<String> applicableRoleCodes);
}
