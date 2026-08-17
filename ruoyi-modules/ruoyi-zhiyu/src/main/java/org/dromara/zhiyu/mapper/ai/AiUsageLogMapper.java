package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.AiUsageLog;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * AI 用量记录 Mapper（ai_usage_logs 表）。
 *
 * @author zhiyu
 */
public interface AiUsageLogMapper extends BaseMapperPlus<AiUsageLog, AiUsageLog> {

    /** 租户 token 总量 */
    @Select("SELECT COALESCE(SUM(total_tokens), 0) FROM ai_usage_logs WHERE tenant_id = #{tenantId}")
    long sumTokens(@Param("tenantId") String tenantId);

    /** 按自然日聚合（升序） */
    @Select("SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,"
        + " COALESCE(SUM(total_tokens), 0) AS tokens, COUNT(*) AS requests"
        + " FROM ai_usage_logs WHERE tenant_id = #{tenantId} AND created_at >= #{since}"
        + " GROUP BY 1 ORDER BY 1")
    List<Map<String, Object>> daily(@Param("tenantId") String tenantId, @Param("since") OffsetDateTime since);
}
