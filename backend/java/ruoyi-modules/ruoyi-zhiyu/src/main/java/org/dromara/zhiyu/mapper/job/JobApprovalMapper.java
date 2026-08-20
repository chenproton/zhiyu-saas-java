package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobApprovalRecord;

/**
 * 审批记录 Mapper（approval_records 表，Go→Java 迁移）。
 *
 * <p>history 为 jsonb 列，实体以原始 JSON 文本读写。
 * 评审走「行锁读取 → 决策 → CAS 推进」语义（对齐 Go ReviewStep 事务），
 * 实体状态同步按目标类型白名单映射实体表（{@link #TARGET_TABLE_MAP} 由 Service 侧维护）。</p>
 *
 * @author zhiyu
 */
public interface JobApprovalMapper extends BaseMapperPlus<JobApprovalRecord, JobApprovalRecord> {

    /**
     * 按 ID 查询审批记录（租户限定）。
     */
    @Select("""
        SELECT id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status,
            submitter_id, history, created_at, updated_at
        FROM approval_records WHERE id = #{id} AND tenant_id = #{tenantId}
        """)
    JobApprovalRecord selectApprovalByIdTenant(@Param("id") String id, @Param("tenantId") String tenantId);

    /**
     * 按 ID 行锁读取审批记录（评审事务内使用，防并发覆盖历史）。
     */
    @Select("""
        SELECT id, tenant_id, target_type, target_id, workflow_id, current_step_idx, status,
            submitter_id, history, created_at, updated_at
        FROM approval_records WHERE id = #{id} FOR UPDATE
        """)
    JobApprovalRecord lockApprovalById(@Param("id") String id);

    /**
     * 目标是否已有待审批记录（唯一索引兜底）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM approval_records"
        + " WHERE target_type = #{targetType} AND target_id = #{targetId} AND status = 'pending')")
    boolean existsPending(@Param("targetType") String targetType, @Param("targetId") String targetId);

    /**
     * 覆写评审历史（仅 pending 状态；行锁保护下调用）。
     *
     * @return 影响行数（0 表示记录已非 pending）
     */
    @Update("UPDATE approval_records SET history = CAST(#{history} AS JSON), updated_at = NOW()"
        + " WHERE id = #{id} AND status = 'pending'")
    int updateHistory(@Param("id") String id, @Param("history") String history);

    /**
     * 推进审批（状态+步骤+历史 CAS 更新，防并发重复推进）。
     *
     * @return 影响行数（0 表示记录已非 pending 或步骤已被并发修改）
     */
    @Update("UPDATE approval_records SET status = #{status}, current_step_idx = #{stepIdx},"
        + " history = CAST(#{history} AS JSON), updated_at = NOW()"
        + " WHERE id = #{id} AND status = 'pending' AND current_step_idx = #{oldStepIdx}")
    int advanceRecord(@Param("id") String id, @Param("status") String status, @Param("stepIdx") int stepIdx,
                      @Param("oldStepIdx") int oldStepIdx, @Param("history") String history);

    /**
     * 同步实体状态（目标类型映射实体表；表名用 &lt;choose&gt; 固定分支白名单，杜绝 ${} 注入面）。
     * 白名单与 {@code JobApprovalServiceImpl.TARGET_TABLE} 一一对应。
     */
    @Update("<script>"
        + "<choose>"
        + "<when test='table == \"career_positions\"'>UPDATE career_positions SET status = #{status}, updated_at = NOW() WHERE id = #{targetId} AND tenant_id = #{tenantId}</when>"
        + "<when test='table == \"scenarios\"'>UPDATE scenarios SET status = #{status}, updated_at = NOW() WHERE id = #{targetId} AND tenant_id = #{tenantId}</when>"
        + "<when test='table == \"courses\"'>UPDATE courses SET status = #{status}, updated_at = NOW() WHERE id = #{targetId} AND tenant_id = #{tenantId}</when>"
        + "<when test='table == \"question_banks\"'>UPDATE question_banks SET status = #{status}, updated_at = NOW() WHERE id = #{targetId} AND tenant_id = #{tenantId}</when>"
        + "<when test='table == \"exams\"'>UPDATE exams SET status = #{status}, updated_at = NOW() WHERE id = #{targetId} AND tenant_id = #{tenantId}</when>"
        + "<when test='table == \"training_programs\"'>UPDATE training_programs SET status = #{status}, updated_at = NOW() WHERE id = #{targetId} AND tenant_id = #{tenantId}</when>"
        + "<when test='table == \"teaching_plans\"'>UPDATE teaching_plans SET status = #{status}, updated_at = NOW() WHERE id = #{targetId} AND tenant_id = #{tenantId}</when>"
        + "</choose>"
        + "</script>")
    int syncEntityStatus(@Param("table") String table, @Param("status") String status,
                         @Param("targetId") String targetId, @Param("tenantId") String tenantId);
}
