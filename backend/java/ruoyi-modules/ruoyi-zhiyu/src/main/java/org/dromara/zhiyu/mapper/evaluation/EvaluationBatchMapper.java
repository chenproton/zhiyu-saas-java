package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationBatch;

import java.util.List;
import java.util.Map;

/**
 * 评价批次 Mapper（evaluation_batches 表）。
 *
 * @author zhiyu
 */
public interface EvaluationBatchMapper extends BaseMapperPlus<EvaluationBatch, EvaluationBatch> {

    @Insert("INSERT INTO evaluation_batches (id, tenant_id, name, code, org_node_id, major_id, workflow_id, status)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{code}, #{orgNodeId}, #{majorId}, #{workflowId}, #{status})")
    int insertBatch(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                    @Param("code") String code, @Param("orgNodeId") String orgNodeId,
                    @Param("majorId") String majorId, @Param("workflowId") String workflowId,
                    @Param("status") String status);

    @Update("UPDATE evaluation_batches SET name = #{name}, code = #{code}, org_node_id = #{orgNodeId},"
        + " major_id = #{majorId}, workflow_id = #{workflowId}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateBatch(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                    @Param("code") String code, @Param("orgNodeId") String orgNodeId,
                    @Param("majorId") String majorId, @Param("workflowId") String workflowId);

    @Update("UPDATE evaluation_batches SET status = #{status}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateStatus(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);

    /** 批量查询专业名称（key=major_id，value=name） */
    @Select("<script>SELECT id, name FROM majors WHERE id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}::uuid</foreach></script>")
    List<Map<String, Object>> selectMajorNames(@Param("ids") List<String> ids);
}
