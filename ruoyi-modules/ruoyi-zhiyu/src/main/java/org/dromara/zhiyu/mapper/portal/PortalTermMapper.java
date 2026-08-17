package org.dromara.zhiyu.mapper.portal;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.portal.PortalTerm;

/**
 * 学期 Mapper（terms 表）。
 *
 * @author zhiyu
 */
public interface PortalTermMapper extends BaseMapperPlus<PortalTerm, PortalTerm> {

    /** 清空当前学期标记（置新当前学期前）。 */
    @Update("UPDATE terms SET is_current = false WHERE tenant_id = #{tenantId}")
    int clearCurrent(@Param("tenantId") String tenantId);

    /** 清空当前学期标记（排除自身，更新场景）。 */
    @Update("UPDATE terms SET is_current = false WHERE tenant_id = #{tenantId} AND id <> #{id}")
    int clearCurrentExcept(@Param("tenantId") String tenantId, @Param("id") String id);
}
