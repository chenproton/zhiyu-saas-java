package org.dromara.zhiyu.mapper.lesson;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeResourceDto;
import org.dromara.zhiyu.domain.lesson.SystemCourseNode;

import java.util.List;

/**
 * 节点/课程资源绑定 Mapper（resource_library + node/course_resource_bindings，Go resource_bindings.go 语义）。
 *
 * @author zhiyu
 */
public interface LessonResourceMapper extends BaseMapperPlus<SystemCourseNode, SystemCourseNode> {

    /** 节点资源列表（绑定节点过滤，search 匹配名称/描述）。 */
    @Select("<script>SELECT rl.id, rl.name, rl.resource_type AS type, rl.url, rl.description,"
        + " COALESCE(rl.file_size, 0)::int AS size, rl.uploaded_by, rl.created_at AS uploaded_at"
        + " FROM resource_library rl"
        + " <if test=\"nodeId != null and nodeId != ''\">JOIN node_resource_bindings tb ON tb.resource_id = rl.id AND tb.node_id = #{nodeId}::uuid</if>"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">AND (rl.name ILIKE #{search} OR rl.description ILIKE #{search})</if>"
        + " ORDER BY rl.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<NodeResourceDto> selectNodeResourcePage(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                                                 @Param("search") String search, @Param("limit") int limit,
                                                 @Param("offset") int offset);

    /** 节点资源列表总数。 */
    @Select("<script>SELECT COUNT(*) FROM resource_library rl"
        + " <if test=\"nodeId != null and nodeId != ''\">JOIN node_resource_bindings tb ON tb.resource_id = rl.id AND tb.node_id = #{nodeId}::uuid</if>"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">AND (rl.name ILIKE #{search} OR rl.description ILIKE #{search})</if></script>")
    long countNodeResourcePage(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                               @Param("search") String search);

    /** 课程资源列表（绑定课程过滤，search 匹配名称/URL）。 */
    @Select("<script>SELECT rl.id, COALESCE(crb.course_id::text, '') AS node_id, rl.name, rl.resource_type AS type,"
        + " rl.url, rl.file_size::int AS size, rl.description, rl.uploaded_by, rl.created_at AS uploaded_at"
        + " FROM resource_library rl"
        + " <if test=\"courseId != null and courseId != ''\">JOIN course_resource_bindings crb ON crb.resource_id = rl.id AND crb.course_id = #{courseId}::uuid</if>"
        + " <if test=\"courseId == null or courseId == ''\">LEFT JOIN course_resource_bindings crb ON crb.resource_id = rl.id</if>"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">AND (rl.name ILIKE #{search} OR rl.url ILIKE #{search})</if>"
        + " ORDER BY rl.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<NodeResourceDto> selectCourseResourcePage(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                                                   @Param("search") String search, @Param("limit") int limit,
                                                   @Param("offset") int offset);

    /** 课程资源列表总数。 */
    @Select("<script>SELECT COUNT(*) FROM resource_library rl"
        + " <if test=\"courseId != null and courseId != ''\">JOIN course_resource_bindings crb ON crb.resource_id = rl.id AND crb.course_id = #{courseId}::uuid</if>"
        + " <if test=\"courseId == null or courseId == ''\">LEFT JOIN course_resource_bindings crb ON crb.resource_id = rl.id</if>"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">AND (rl.name ILIKE #{search} OR rl.url ILIKE #{search})</if></script>")
    long countCourseResourcePage(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                                 @Param("search") String search);

    /** 新建资源库条目（resource_type 为 PG 枚举）。 */
    @Insert("INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, file_size, uploaded_by)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{name}, #{type}::resource_type, #{url}, #{description}, #{fileSize}, #{uploadedBy}::uuid)")
    int insertResourceLibrary(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                              @Param("type") String type, @Param("url") String url,
                              @Param("description") String description, @Param("fileSize") Long fileSize,
                              @Param("uploadedBy") String uploadedBy);

    /** 新建节点资源绑定（创建流程，幂等）。 */
    @Insert("INSERT INTO node_resource_bindings (id, tenant_id, node_id, resource_id)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{nodeId}::uuid, #{resourceId}::uuid)"
        + " ON CONFLICT (node_id, resource_id) DO NOTHING")
    int insertNodeBinding(@Param("id") String id, @Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                          @Param("resourceId") String resourceId);

    /** 新建课程资源绑定（创建流程，幂等）。 */
    @Insert("INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{courseId}::uuid, #{resourceId}::uuid)"
        + " ON CONFLICT (course_id, resource_id) DO NOTHING")
    int insertCourseBinding(@Param("id") String id, @Param("tenantId") String tenantId, @Param("courseId") String courseId,
                            @Param("resourceId") String resourceId);

    /** 绑定已有节点资源（返回绑定 ID）。 */
    @Select("INSERT INTO node_resource_bindings (tenant_id, node_id, resource_id)"
        + " VALUES (#{tenantId}, #{nodeId}, #{resourceId})"
        + " ON CONFLICT (node_id, resource_id) DO UPDATE SET node_id = EXCLUDED.node_id RETURNING id")
    String bindNodeResource(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                            @Param("resourceId") String resourceId);

    /** 绑定已有课程资源（返回绑定 ID）。 */
    @Select("INSERT INTO course_resource_bindings (tenant_id, course_id, resource_id)"
        + " VALUES (#{tenantId}, #{courseId}, #{resourceId})"
        + " ON CONFLICT (course_id, resource_id) DO UPDATE SET course_id = EXCLUDED.course_id RETURNING id")
    String bindCourseResource(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                              @Param("resourceId") String resourceId);

    /** 查询节点绑定行关联的节点 ID（解绑租户归属校验用）。 */
    @Select("SELECT node_id FROM node_resource_bindings WHERE id = #{id}")
    String selectNodeBindingTarget(@Param("id") String id);

    /** 查询课程绑定行关联的课程 ID（解绑租户归属校验用）。 */
    @Select("SELECT course_id FROM course_resource_bindings WHERE id = #{id}")
    String selectCourseBindingTarget(@Param("id") String id);

    /** 删除节点绑定。 */
    @Delete("DELETE FROM node_resource_bindings WHERE id = #{id}")
    int deleteNodeBinding(@Param("id") String id);

    /** 删除课程绑定。 */
    @Delete("DELETE FROM course_resource_bindings WHERE id = #{id}")
    int deleteCourseBinding(@Param("id") String id);

    /** 课程绑定后同步 courses.resource_ids 聚合字段。 */
    @Update("UPDATE courses SET resource_ids = array_append(resource_ids, #{resourceId}::uuid),"
        + " resource_count = COALESCE(array_length(array_append(resource_ids, #{resourceId}::uuid), 1), 0)"
        + " WHERE id = #{courseId} AND NOT (#{resourceId}::uuid = ANY(resource_ids))")
    int syncCourseResourceBind(@Param("courseId") String courseId, @Param("resourceId") String resourceId);

    /** 课程解绑后同步 courses.resource_ids 聚合字段。 */
    @Update("UPDATE courses SET resource_ids = array_remove(resource_ids, #{resourceId}::uuid),"
        + " resource_count = COALESCE(array_length(array_remove(resource_ids, #{resourceId}::uuid), 1), 0)"
        + " WHERE id = #{courseId}")
    int syncCourseResourceUnbind(@Param("courseId") String courseId, @Param("resourceId") String resourceId);

    /** 校验资源归属当前租户（节点引用校验用）。 */
    @Select("<script>SELECT COUNT(*) FROM resource_library WHERE tenant_id = #{tenantId}"
        + " AND id = ANY(CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]))</script>")
    long countResourcesInTenant(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);
}
