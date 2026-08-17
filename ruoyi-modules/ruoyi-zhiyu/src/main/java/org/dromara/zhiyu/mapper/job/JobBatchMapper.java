package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobBatch;

import java.util.List;

/**
 * 岗位批次 Mapper（batches 表，Go→Java 迁移）。
 *
 * <p>列表/详情需 LEFT JOIN majors 带出专业名称，走自定义 SQL；其余简单操作走内置方法。</p>
 *
 * @author zhiyu
 */
public interface JobBatchMapper extends BaseMapperPlus<JobBatch, JobBatch> {

    /** 批次列（含专业名称 JOIN 列） */
    String SELECT_COLUMNS = "b.id, b.tenant_id, b.name, b.code, b.org_node_id, b.major_id,"
        + " COALESCE(m.name, '') AS major_name, b.workflow_id, b.status, b.position_count,"
        + " b.published_count, b.pending_count, b.created_at, b.updated_at";

    String FROM_CLAUSE = "FROM batches b LEFT JOIN majors m ON m.id = b.major_id";

    /** 列表过滤条件（租户 + orgNodeId/status/search，供计数/分页复用） */
    String FILTER_FRAGMENT = "<where>"
        + " b.tenant_id = #{tenantId}::uuid"
        + " <if test=\"orgNodeId != null and orgNodeId != ''\">AND b.org_node_id = #{orgNodeId}::uuid</if>"
        + " <if test=\"status != null and status != ''\">AND b.status = #{status}</if>"
        + " <if test=\"search != null and search != ''\">"
        + " AND b.name ILIKE #{search} ESCAPE '\\'"
        + " </if>"
        + "</where>";

    /**
     * 分页查询批次列表。
     */
    @Select("<script>SELECT " + SELECT_COLUMNS + " " + FROM_CLAUSE + " " + FILTER_FRAGMENT
        + " ORDER BY b.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<JobBatch> selectBatchPage(@Param("tenantId") String tenantId, @Param("orgNodeId") String orgNodeId,
                                   @Param("status") String status, @Param("search") String search,
                                   @Param("limit") int limit, @Param("offset") int offset);

    /**
     * 批次列表总数（与 {@link #selectBatchPage} 同条件）。
     */
    @Select("<script>SELECT COUNT(*) " + FROM_CLAUSE + " " + FILTER_FRAGMENT + "</script>")
    long countBatchPage(@Param("tenantId") String tenantId, @Param("orgNodeId") String orgNodeId,
                        @Param("status") String status, @Param("search") String search);

    /**
     * 按 ID 查询批次（含专业名称；租户归属由 Service 校验）。
     */
    @Select("SELECT " + SELECT_COLUMNS + " " + FROM_CLAUSE + " WHERE b.id = #{id}")
    JobBatch selectItemById(@Param("id") String id);

    /**
     * 查询批次租户（归属校验用）。
     */
    @Select("SELECT tenant_id FROM batches WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    /**
     * 更新批次（COALESCE 保留原值语义；status 仅当非空时更新，对齐 Go BatchStore.UpdateFields）。
     */
    @Update("<script>UPDATE batches SET name = #{name},"
        + " code = COALESCE(#{code}, code), org_node_id = COALESCE(#{orgNodeId}::uuid, org_node_id),"
        + " major_id = COALESCE(#{majorId}::uuid, major_id), workflow_id = COALESCE(#{workflowId}::uuid, workflow_id),"
        + " updated_at = NOW()"
        + " <if test=\"status != null and status != ''\">, status = #{status}</if>"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}</script>")
    int updateBatch(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                    @Param("code") String code, @Param("orgNodeId") String orgNodeId,
                    @Param("majorId") String majorId, @Param("workflowId") String workflowId,
                    @Param("status") String status);

    /**
     * 更新批次状态（限定租户）。
     */
    @Update("UPDATE batches SET status = #{status}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateStatus(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);

    /**
     * 删除批次（限定租户）。
     */
    @Delete("DELETE FROM batches WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteBatch(@Param("id") String id, @Param("tenantId") String tenantId);
}
