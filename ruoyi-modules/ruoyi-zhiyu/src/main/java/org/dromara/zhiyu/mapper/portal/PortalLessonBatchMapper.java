package org.dromara.zhiyu.mapper.portal;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.portal.PortalLessonBatch;

import java.util.List;

/**
 * 课程批次 Mapper（lesson_batches 表，Go batch_configs.go NewCourseBatchTableConfig 语义）。
 *
 * @author zhiyu
 */
public interface PortalLessonBatchMapper extends BaseMapperPlus<PortalLessonBatch, PortalLessonBatch> {

    String SELECT_COLUMNS = "lb.id, lb.name, lb.code, lb.org_node_id, lb.major_id, COALESCE(m.name, '') AS major_name,"
        + " lb.workflow_id, lb.status, lb.course_count, lb.created_at, lb.updated_at, lb.tenant_id";

    String FROM_CLAUSE = "FROM lesson_batches lb LEFT JOIN majors m ON m.id = lb.major_id";

    String FILTER_FRAGMENT = "<where>"
        + " lb.tenant_id = #{tenantId}"
        + " <if test=\"orgNodeId != null and orgNodeId != ''\">AND lb.org_node_id = #{orgNodeId}</if>"
        + " <if test=\"status != null and status != ''\">AND lb.status = #{status}</if>"
        + " <if test=\"majorId != null and majorId != ''\">AND lb.major_id = #{majorId}</if>"
        + " <if test=\"search != null and search != ''\">AND (lb.name LIKE #{search} OR lb.code LIKE #{search})</if>"
        + "</where>";

    @Select("<script>SELECT " + SELECT_COLUMNS + " " + FROM_CLAUSE + " " + FILTER_FRAGMENT
        + " ORDER BY lb.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<PortalLessonBatch> selectBatchPage(@Param("tenantId") String tenantId, @Param("orgNodeId") String orgNodeId,
                                            @Param("status") String status, @Param("majorId") String majorId,
                                            @Param("search") String search, @Param("limit") int limit,
                                            @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) " + FROM_CLAUSE + " " + FILTER_FRAGMENT + "</script>")
    long countBatchPage(@Param("tenantId") String tenantId, @Param("orgNodeId") String orgNodeId,
                        @Param("status") String status, @Param("majorId") String majorId,
                        @Param("search") String search);

    @Select("SELECT " + SELECT_COLUMNS + " " + FROM_CLAUSE + " WHERE lb.id = #{id}")
    PortalLessonBatch selectItemById(@Param("id") String id);

    @Select("SELECT tenant_id FROM lesson_batches WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    @Insert("INSERT INTO lesson_batches (id, tenant_id, name, code, org_node_id, major_id, workflow_id, status, course_count)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{code}, #{orgNodeId}, #{majorId},"
        + " #{workflowId}, #{status}, 0)")
    int insertBatch(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                    @Param("code") String code, @Param("orgNodeId") String orgNodeId, @Param("majorId") String majorId,
                    @Param("workflowId") String workflowId, @Param("status") String status);

    @Update("<script>UPDATE lesson_batches SET name = #{name},"
        + " code = COALESCE(#{code}, code), org_node_id = COALESCE(#{orgNodeId}, org_node_id),"
        + " major_id = COALESCE(#{majorId}, major_id), workflow_id = COALESCE(#{workflowId}, workflow_id),"
        + " updated_at = NOW()"
        + " <if test=\"status != null and status != ''\">, status = #{status}</if>"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}</script>")
    int updateBatch(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                    @Param("code") String code, @Param("orgNodeId") String orgNodeId,
                    @Param("majorId") String majorId, @Param("workflowId") String workflowId,
                    @Param("status") String status);

    @Update("UPDATE lesson_batches SET status = #{status}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateStatus(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);

    @Delete("DELETE FROM lesson_batches WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteBatch(@Param("id") String id, @Param("tenantId") String tenantId);
}
