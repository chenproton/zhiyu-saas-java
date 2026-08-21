package org.dromara.zhiyu.mapper.portal;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.portal.PortalViewCounter;

/**
 * 阅读计数 Mapper（view_counters 表）。
 *
 * @author zhiyu
 */
public interface PortalViewCounterMapper extends BaseMapperPlus<PortalViewCounter, PortalViewCounter> {

    /**
     * 累计阅读（对齐 Go RecordView：插入 view_logs + 计数 upsert）。
     */
    @Insert("""
        INSERT INTO view_logs (target_type, target_id, user_id, tenant_id)
        VALUES (#{targetType}, #{targetId}, #{userId}, NULLIF(#{tenantId}, ''))
        """)
    int logView(@Param("targetType") String targetType, @Param("targetId") String targetId,
                @Param("userId") String userId, @Param("tenantId") String tenantId);

    /**
     * 计数 upsert（ON CONFLICT 累加，对齐 Go 版 SQL）。
     */
    @Insert("""
        INSERT INTO view_counters (target_type, target_id, cnt)
        VALUES (#{targetType}, #{targetId}, 1)
        ON DUPLICATE KEY UPDATE cnt = view_counters.cnt + 1, updated_at = now()
        """)
    int increment(@Param("targetType") String targetType, @Param("targetId") String targetId);
}
