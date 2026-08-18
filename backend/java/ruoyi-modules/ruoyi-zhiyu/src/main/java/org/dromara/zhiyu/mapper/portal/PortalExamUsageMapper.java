package org.dromara.zhiyu.mapper.portal;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.portal.PortalExamUsage;

/**
 * 考试安排 Mapper（exam_usages 表）。
 *
 * @author zhiyu
 */
public interface PortalExamUsageMapper extends BaseMapperPlus<PortalExamUsage, PortalExamUsage> {

    /**
     * 定时激活考试状态同步（对齐 Go SyncScheduledExamUsageStatus：scheduled 模式
     * draft→published→finished 按时间推进）。
     */
    @Update("""
        UPDATE exam_usages SET status = CASE
            WHEN activation_mode = 'scheduled' AND status IN ('draft', 'published') AND end_time IS NOT NULL AND #{now} >= end_time THEN 'finished'
            WHEN activation_mode = 'scheduled' AND status = 'draft' AND start_time IS NOT NULL AND #{now} >= start_time THEN 'published'
            ELSE status
        END, updated_at = NOW()
        WHERE activation_mode = 'scheduled' AND status IN ('draft', 'published')
            AND (start_time IS NOT NULL AND #{now} >= start_time OR end_time IS NOT NULL AND #{now} >= end_time)
            AND (COALESCE(#{tenantId}, '') = '' OR tenant_id = #{tenantId}::uuid)
        """)
    int syncScheduledExamUsageStatus(@Param("tenantId") String tenantId, @Param("now") java.time.OffsetDateTime now);
}
