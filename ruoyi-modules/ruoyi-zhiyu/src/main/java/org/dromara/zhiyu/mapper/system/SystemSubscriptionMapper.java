package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.JsonMapTypeHandler;
import org.dromara.zhiyu.domain.system.SystemSubscriptionPackage;

import java.util.Map;

/**
 * 订阅套餐 Mapper（subscription_packages 表）。
 *
 * @author zhiyu
 */
public interface SystemSubscriptionMapper extends BaseMapperPlus<SystemSubscriptionPackage, SystemSubscriptionPackage> {

    @Select("SELECT id, tenant_id, name, valid_until::text AS valid_until, modules, status, ai_token_quota, created_at, updated_at"
        + " FROM subscription_packages WHERE tenant_id = #{tenantId} ORDER BY created_at DESC LIMIT 1")
    @Results({
        @Result(column = "modules", property = "modules", typeHandler = JsonMapTypeHandler.class)
    })
    SystemSubscriptionPackage selectByTenant(@Param("tenantId") String tenantId);

    @Insert("INSERT INTO subscription_packages (id, tenant_id, name, valid_until, modules, status, ai_token_quota)"
        + " VALUES (#{id}, #{tenantId}, #{name}, CAST(NULLIF(#{validUntil}, '') AS date),"
        + " CAST(#{modules, typeHandler=org.dromara.zhiyu.core.mybatis.JsonMapTypeHandler} AS jsonb), #{status}, COALESCE(#{aiTokenQuota}, 0))")
    int insertSubscription(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                           @Param("validUntil") String validUntil, @Param("modules") Map<String, Object> modules,
                           @Param("status") String status, @Param("aiTokenQuota") Long aiTokenQuota);

    @Update("UPDATE subscription_packages SET name = #{name}, valid_until = CAST(NULLIF(#{validUntil}, '') AS date),"
        + " modules = CAST(#{modules, typeHandler=org.dromara.zhiyu.core.mybatis.JsonMapTypeHandler} AS jsonb),"
        + " status = #{status}, ai_token_quota = COALESCE(#{aiTokenQuota}, ai_token_quota), updated_at = NOW()"
        + " WHERE id = #{id}")
    int updateSubscription(@Param("id") String id, @Param("name") String name, @Param("validUntil") String validUntil,
                           @Param("modules") Map<String, Object> modules, @Param("status") String status,
                           @Param("aiTokenQuota") Long aiTokenQuota);
}
