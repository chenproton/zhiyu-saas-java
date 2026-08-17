package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobWorkflow;

/**
 * 审批流程 Mapper（workflows 表，Go→Java 迁移）。
 *
 * <p>steps/major_ids 为 jsonb 列，实体以原始 JSON 文本读写（getString/setString 语义）。</p>
 *
 * @author zhiyu
 */
public interface JobWorkflowMapper extends BaseMapperPlus<JobWorkflow, JobWorkflow> {

    /**
     * 按 ID 查询流程（租户限定）。
     */
    @Select("""
        SELECT id, tenant_id, name, scene, description, steps, major_ids, usage_count, status, created_at
        FROM workflows WHERE id = #{id} AND tenant_id = #{tenantId}
        """)
    JobWorkflow selectWorkflowById(@Param("id") String id, @Param("tenantId") String tenantId);

    /**
     * 更新流程（限定租户；steps/major_ids 显式 CAST 为 jsonb）。
     */
    @Update("""
        UPDATE workflows SET
            name = #{name}, scene = #{scene}, description = #{description},
            steps = CAST(#{steps} AS jsonb), major_ids = CAST(#{majorIds} AS jsonb), status = #{status}
        WHERE id = #{id} AND tenant_id = #{tenantId}
        """)
    int updateWorkflow(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                       @Param("scene") String scene, @Param("description") String description,
                       @Param("steps") String steps, @Param("majorIds") String majorIds, @Param("status") String status);

    /**
     * 删除流程（限定租户）。
     */
    @Delete("DELETE FROM workflows WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteWorkflow(@Param("id") String id, @Param("tenantId") String tenantId);

    /**
     * 流程是否仍有待审批单（删除前引用检查）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM approval_records WHERE workflow_id = #{workflowId} AND status = 'pending')")
    boolean existsPendingApprovals(@Param("workflowId") String workflowId);
}
