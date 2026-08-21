package org.dromara.zhiyu.mapper.lesson;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.lesson.HybridNodeModule;

import java.util.List;

/**
 * 混合模块 Mapper（hybrid_node_modules 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface HybridNodeModuleMapper extends BaseMapperPlus<HybridNodeModule, HybridNodeModule> {

    /** 列表（nodeId/courseId 过滤，module_key 排序，无分页）。 */
    @Select("<script>SELECT id, node_id, module_key, mode, data AS data, tenant_id"
        + " FROM hybrid_node_modules WHERE tenant_id = #{tenantId}"
        + " <if test=\"nodeId != null and nodeId != ''\">AND node_id = #{nodeId}</if>"
        + " <if test=\"courseId != null and courseId != ''\">"
        + " AND node_id IN (SELECT id FROM system_course_nodes WHERE course_id = #{courseId})</if>"
        + " ORDER BY module_key ASC</script>")
    List<HybridNodeModule> selectModules(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                                         @Param("courseId") String courseId);

    /** 删除某节点全部模块（批量替换用，限定租户）。 */
    @Delete("DELETE FROM hybrid_node_modules WHERE node_id = #{nodeId} AND tenant_id = #{tenantId}")
    int deleteByNode(@Param("nodeId") String nodeId, @Param("tenantId") String tenantId);

    /** 插入模块（data 为 jsonb）。 */
    @Insert("INSERT INTO hybrid_node_modules (id, tenant_id, node_id, module_key, mode, data)"
        + " VALUES ((UUID()), #{tenantId}, #{nodeId}, #{moduleKey}, #{mode}, CAST(#{data} AS JSON))")
    int insertModule(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                     @Param("moduleKey") String moduleKey, @Param("mode") String mode, @Param("data") String data);

    /** 查询单个模块（限定租户，归属校验用）。 */
    @Select("SELECT id, node_id, module_key, mode, data AS data, tenant_id FROM hybrid_node_modules"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    HybridNodeModule selectModule(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 插入模块（upsert 创建分支用；id 由 Service 生成 UUID）。 */
    @Insert("INSERT INTO hybrid_node_modules (id, tenant_id, node_id, module_key, mode, data)"
        + " VALUES (#{id}, #{tenantId}, #{nodeId}, #{moduleKey}, #{mode}, CAST(#{data} AS JSON))")
    int insertModuleReturnId(@Param("id") String id, @Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                             @Param("moduleKey") String moduleKey, @Param("mode") String mode,
                             @Param("data") String data);

    /** 更新模块（限定租户）。 */
    @Update("UPDATE hybrid_node_modules SET node_id = #{nodeId}, module_key = #{moduleKey},"
        + " mode = #{mode}, data = CAST(#{data} AS JSON)"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateModule(@Param("id") String id, @Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                     @Param("moduleKey") String moduleKey, @Param("mode") String mode, @Param("data") String data);

    /** 删除模块（限定租户）。 */
    @Delete("DELETE FROM hybrid_node_modules WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteModule(@Param("id") String id, @Param("tenantId") String tenantId);
}
