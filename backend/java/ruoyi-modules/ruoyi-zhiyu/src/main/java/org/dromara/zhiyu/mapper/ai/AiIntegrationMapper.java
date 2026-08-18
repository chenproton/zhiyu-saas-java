package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.AiIntegration;

/**
 * 第三方挂接 Mapper（ai_integrations 表）。
 *
 * @author zhiyu
 */
public interface AiIntegrationMapper extends BaseMapperPlus<AiIntegration, AiIntegration> {

    /** 上下架切换（返回影响行数） */
    @Update("UPDATE ai_integrations SET status = #{status}, updated_at = now()"
        + " WHERE tenant_id = #{tenantId} AND id = #{id}")
    int setStatus(@Param("tenantId") String tenantId, @Param("id") String id, @Param("status") String status);
}
