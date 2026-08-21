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
        + " COALESCE(rl.file_size, 0) AS size, rl.uploaded_by, rl.created_at AS uploaded_at"
        + " FROM resource_library rl"
        + " <if test=\"nodeId != null and nodeId != ''\">JOIN node_resource_bindings tb ON tb.resource_id = rl.id AND tb.node_id = #{nodeId}</if>"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">AND (rl.name LIKE #{search} OR rl.description LIKE #{search})</if>"
        + " ORDER BY rl.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<NodeResourceDto> selectNodeResourcePage(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                                                 @Param("search") String search, @Param("limit") int limit,
                                                 @Param("offset") int offset);

    /** 节点资源列表总数。 */
    @Select("<script>SELECT COUNT(*) FROM resource_library rl"
        + " <if test=\"nodeId != null and nodeId != ''\">JOIN node_resource_bindings tb ON tb.resource_id = rl.id AND tb.node_id = #{nodeId}</if>"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">AND (rl.name LIKE #{search} OR rl.description LIKE #{search})</if></script>")
    long countNodeResourcePage(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                               @Param("search") String search);

    /** 课程资源列表（绑定课程过滤，search 匹配名称/URL）。 */
    @Select("<script>SELECT rl.id, COALESCE(crb.course_id, '') AS node_id, rl.name, rl.resource_type AS type,"
        + " rl.url, rl.file_size AS size, rl.description, rl.uploaded_by, rl.created_at AS uploaded_at"
        + " FROM resource_library rl"
        + " <if test=\"courseId != null and courseId != ''\">JOIN course_resource_bindings crb ON crb.resource_id = rl.id AND crb.course_id = #{courseId}</if>"
        + " <if test=\"courseId == null or courseId == ''\">LEFT JOIN course_resource_bindings crb ON crb.resource_id = rl.id</if>"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">AND (rl.name LIKE #{search} OR rl.url LIKE #{search})</if>"
        + " ORDER BY rl.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<NodeResourceDto> selectCourseResourcePage(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                                                   @Param("search") String search, @Param("limit") int limit,
                                                   @Param("offset") int offset);

    /** 课程资源列表总数。 */
    @Select("<script>SELECT COUNT(*) FROM resource_library rl"
        + " <if test=\"courseId != null and courseId != ''\">JOIN course_resource_bindings crb ON crb.resource_id = rl.id AND crb.course_id = #{courseId}</if>"
        + " <if test=\"courseId == null or courseId == ''\">LEFT JOIN course_resource_bindings crb ON crb.resource_id = rl.id</if>"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">AND (rl.name LIKE #{search} OR rl.url LIKE #{search})</if></script>")
    long countCourseResourcePage(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                                 @Param("search") String search);

    /** 新建资源库条目（resource_type 为 PG 枚举）。 */
    @Insert("INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, file_size, uploaded_by)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{type}, #{url}, #{description}, #{fileSize}, #{uploadedBy})")
    int insertResourceLibrary(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                              @Param("type") String type, @Param("url") String url,
                              @Param("description") String description, @Param("fileSize") Long fileSize,
                              @Param("uploadedBy") String uploadedBy);

    /** 新建节点资源绑定（创建流程，幂等）。 */
    @Insert("INSERT INTO node_resource_bindings (id, tenant_id, node_id, resource_id)"
        + " VALUES (#{id}, #{tenantId}, #{nodeId}, #{resourceId})"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertNodeBinding(@Param("id") String id, @Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                          @Param("resourceId") String resourceId);

    /** 新建课程资源绑定（创建流程，幂等）。 */
    @Insert("INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)"
        + " VALUES (#{id}, #{tenantId}, #{courseId}, #{resourceId})"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertCourseBinding(@Param("id") String id, @Param("tenantId") String tenantId, @Param("courseId") String courseId,
                            @Param("resourceId") String resourceId);

    /** 绑定已有节点资源（幂等 upsert，不返回 id；冲突命中时按唯一键回读，对齐 Go RETURNING id）。 */
    @Insert("INSERT INTO node_resource_bindings (tenant_id, node_id, resource_id)"
        + " VALUES (#{tenantId}, #{nodeId}, #{resourceId})"
        + " ON DUPLICATE KEY UPDATE node_id = VALUES(node_id)")
    int upsertNodeBinding(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                          @Param("resourceId") String resourceId);

    /** 按唯一键回读节点绑定 id（upsert 冲突命中时返回实际行 id）。 */
    @Select("SELECT id FROM node_resource_bindings WHERE node_id = #{nodeId} AND resource_id = #{resourceId}")
    String selectNodeBindingId(@Param("nodeId") String nodeId, @Param("resourceId") String resourceId);

    /** 绑定已有课程资源（幂等 upsert，不返回 id；冲突命中时按唯一键回读，对齐 Go RETURNING id）。 */
    @Insert("INSERT INTO course_resource_bindings (tenant_id, course_id, resource_id)"
        + " VALUES (#{tenantId}, #{courseId}, #{resourceId})"
        + " ON DUPLICATE KEY UPDATE course_id = VALUES(course_id)")
    int upsertCourseBinding(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                            @Param("resourceId") String resourceId);

    /** 按唯一键回读课程绑定 id（upsert 冲突命中时返回实际行 id）。 */
    @Select("SELECT id FROM course_resource_bindings WHERE course_id = #{courseId} AND resource_id = #{resourceId}")
    String selectCourseBindingId(@Param("courseId") String courseId, @Param("resourceId") String resourceId);

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
    @Update("UPDATE courses SET resource_ids = JSON_ARRAY_APPEND(resource_ids, '$', #{resourceId}),"
        + " resource_count = COALESCE(JSON_LENGTH(JSON_ARRAY_APPEND(resource_ids, '$', #{resourceId})), 0)"
        + " WHERE id = #{courseId} AND NOT JSON_CONTAINS(resource_ids, JSON_QUOTE(#{resourceId}), '$')")
    int syncCourseResourceBind(@Param("courseId") String courseId, @Param("resourceId") String resourceId);

    /** 课程解绑后同步 courses.resource_ids 聚合字段。 */
    @Update("UPDATE courses SET resource_ids = JSON_REMOVE(resource_ids, JSON_UNQUOTE(JSON_SEARCH(resource_ids, 'one', #{resourceId}))),"
        + " resource_count = COALESCE(JSON_LENGTH(JSON_REMOVE(resource_ids, JSON_UNQUOTE(JSON_SEARCH(resource_ids, 'one', #{resourceId})))), 0)"
        + " WHERE id = #{courseId}")
    int syncCourseResourceUnbind(@Param("courseId") String courseId, @Param("resourceId") String resourceId);

    /** 校验资源归属当前租户（节点引用校验用）。 */
    @Select("<script>SELECT COUNT(*) FROM resource_library WHERE tenant_id = #{tenantId}"
        + " AND JSON_CONTAINS(CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS JSON), JSON_QUOTE(id), '$')</script>")
    long countResourcesInTenant(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);
}
