package org.dromara.zhiyu.mapper.lesson;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationBucketDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.lesson.KnowledgePoint;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 知识点 Mapper（knowledge_points 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface KnowledgePointMapper extends BaseMapperPlus<KnowledgePoint, KnowledgePoint> {

    /** 查询知识点租户（归属校验用）。 */
    @Select("SELECT tenant_id FROM knowledge_points WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    /** 创建知识点（granular_lesson_ids 为 uuid[]）。 */
    @Insert("INSERT INTO knowledge_points (id, tenant_id, name, code, description, linked, granular_lesson_ids, creator_id, source_type, source_id)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{code}, #{description}, #{linked},"
        + " #{granularLessonIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{creatorId}, #{sourceType}, #{sourceId})")
    int insertKnowledgePoint(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                             @Param("code") String code, @Param("description") String description,
                             @Param("linked") Boolean linked, @Param("granularLessonIds") List<String> granularLessonIds,
                             @Param("creatorId") String creatorId, @Param("sourceType") String sourceType,
                             @Param("sourceId") String sourceId);

    /** 更新知识点（限定租户）。 */
    @Update("UPDATE knowledge_points SET name = #{name}, code = #{code}, description = #{description},"
        + " linked = #{linked}, granular_lesson_ids = #{granularLessonIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateKnowledgePoint(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                             @Param("code") String code, @Param("description") String description,
                             @Param("linked") Boolean linked, @Param("granularLessonIds") List<String> granularLessonIds);

    /** 删除知识点（限定租户）。 */
    @Delete("DELETE FROM knowledge_points WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteKnowledgePoint(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 同步颗粒课对知识点的双向引用：追加（courses.knowledge_point_ids）。 */
    @Update("UPDATE courses SET knowledge_point_ids = JSON_ARRAY_APPEND(knowledge_point_ids, '$', #{kpId}), updated_at = NOW()"
        + " WHERE tenant_id = #{tenantId} AND JSON_CONTAINS(CAST(#{courseIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS JSON), JSON_QUOTE(id), '$')"
        + " AND NOT JSON_CONTAINS(knowledge_point_ids, JSON_QUOTE(#{kpId}), '$')")
    int appendKpToCourses(@Param("kpId") String kpId, @Param("tenantId") String tenantId,
                          @Param("courseIds") List<String> courseIds);

    /** 同步颗粒课对知识点的双向引用：移除（courseIds 为空时不排除任何课程，对齐 PG id <> ALL('{}') 恒真语义）。 */
    @Update("<script>UPDATE courses SET knowledge_point_ids = JSON_REMOVE(knowledge_point_ids, JSON_UNQUOTE(JSON_SEARCH(knowledge_point_ids, 'one', #{kpId}))), updated_at = NOW()"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test=\"courseIds != null and !courseIds.isEmpty()\">AND id NOT IN"
        + " <foreach collection=\"courseIds\" item=\"c\" open=\"(\" separator=\",\" close=\")\">#{c}</foreach></if>"
        + " AND JSON_CONTAINS(knowledge_point_ids, JSON_QUOTE(#{kpId}), '$')</script>")
    int removeKpFromCourses(@Param("kpId") String kpId, @Param("tenantId") String tenantId,
                            @Param("courseIds") List<String> courseIds);

    /** 课程创建/更新时同步知识点颗粒课引用：追加课程 ID。 */
    @Update("UPDATE knowledge_points SET granular_lesson_ids = JSON_ARRAY_APPEND(granular_lesson_ids, '$', #{courseId}), updated_at = NOW()"
        + " WHERE tenant_id = #{tenantId} AND JSON_CONTAINS(CAST(#{kpIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS JSON), JSON_QUOTE(id), '$')"
        + " AND NOT JSON_CONTAINS(granular_lesson_ids, JSON_QUOTE(#{courseId}), '$')")
    int appendCourseToGranularLessons(@Param("courseId") String courseId, @Param("tenantId") String tenantId,
                                      @Param("kpIds") List<String> kpIds);

    /** 课程创建/更新时同步知识点颗粒课引用：移除课程 ID（kpIds 为空时不排除任何知识点，同上恒真语义）。 */
    @Update("<script>UPDATE knowledge_points SET granular_lesson_ids = JSON_REMOVE(granular_lesson_ids, JSON_UNQUOTE(JSON_SEARCH(granular_lesson_ids, 'one', #{courseId}))), updated_at = NOW()"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test=\"kpIds != null and !kpIds.isEmpty()\">AND id NOT IN"
        + " <foreach collection=\"kpIds\" item=\"k\" open=\"(\" separator=\",\" close=\")\">#{k}</foreach></if>"
        + " AND JSON_CONTAINS(granular_lesson_ids, JSON_QUOTE(#{courseId}), '$')</script>")
    int removeCourseFromGranularLessons(@Param("courseId") String courseId, @Param("tenantId") String tenantId,
                                        @Param("kpIds") List<String> kpIds);

    /** 知识点引用次数分桶统计（对齐 Go KnowledgePointStore.CitationStats）。 */
    @Select("SELECT CASE WHEN ref_count = 0 THEN '0次' WHEN ref_count <= 5 THEN '1-5次'"
        + " WHEN ref_count <= 10 THEN '6-10次' WHEN ref_count <= 100 THEN '11-100次' ELSE '100次以上' END AS label,"
        + " COUNT(*) AS count"
        + " FROM (SELECT kp.id,"
        + " COALESCE((SELECT COUNT(*) FROM courses c WHERE JSON_CONTAINS(c.knowledge_point_ids, JSON_QUOTE(kp.id), '$')), 0)"
        + " + COALESCE((SELECT COUNT(*) FROM node_knowledge_point_bindings nb WHERE nb.knowledge_point_id = kp.id), 0)"
        + " + COALESCE((SELECT COUNT(*) FROM question_bank_knowledge_points qb WHERE qb.knowledge_point_id = kp.id), 0)"
        + " + COALESCE((SELECT COUNT(*) FROM questions q WHERE JSON_CONTAINS(q.knowledge_point_ids, JSON_QUOTE(kp.id), '$')), 0) AS ref_count"
        + " FROM knowledge_points kp WHERE kp.tenant_id = #{tenantId}) refs GROUP BY label")
    List<CitationBucketDto> citationBuckets(@Param("tenantId") String tenantId);

    /** 零引用知识点总数。 */
    @Select("<script>SELECT COUNT(*) FROM knowledge_points kp WHERE kp.tenant_id = #{tenantId}"
        + " <if test=\"from != null\">AND kp.created_at &gt;= #{from}</if>"
        + " <if test=\"to != null\">AND kp.created_at &lt; #{to}</if>"
        + " AND NOT EXISTS (SELECT 1 FROM courses c WHERE JSON_CONTAINS(c.knowledge_point_ids, JSON_QUOTE(kp.id), '$'))"
        + " AND NOT EXISTS (SELECT 1 FROM node_knowledge_point_bindings nb WHERE nb.knowledge_point_id = kp.id)"
        + " AND NOT EXISTS (SELECT 1 FROM question_bank_knowledge_points qb WHERE qb.knowledge_point_id = kp.id)"
        + " AND NOT EXISTS (SELECT 1 FROM questions q WHERE JSON_CONTAINS(q.knowledge_point_ids, JSON_QUOTE(kp.id), '$'))</script>")
    long countUncited(@Param("tenantId") String tenantId, @Param("from") OffsetDateTime from,
                      @Param("to") OffsetDateTime to);

    /** 零引用知识点分页列表。 */
    @Select("<script>SELECT kp.id, kp.name, kp.created_at FROM knowledge_points kp WHERE kp.tenant_id = #{tenantId}"
        + " <if test=\"from != null\">AND kp.created_at &gt;= #{from}</if>"
        + " <if test=\"to != null\">AND kp.created_at &lt; #{to}</if>"
        + " AND NOT EXISTS (SELECT 1 FROM courses c WHERE JSON_CONTAINS(c.knowledge_point_ids, JSON_QUOTE(kp.id), '$'))"
        + " AND NOT EXISTS (SELECT 1 FROM node_knowledge_point_bindings nb WHERE nb.knowledge_point_id = kp.id)"
        + " AND NOT EXISTS (SELECT 1 FROM question_bank_knowledge_points qb WHERE qb.knowledge_point_id = kp.id)"
        + " AND NOT EXISTS (SELECT 1 FROM questions q WHERE JSON_CONTAINS(q.knowledge_point_ids, JSON_QUOTE(kp.id), '$'))"
        + " ORDER BY kp.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<UncitedItemDto> listUncited(@Param("tenantId") String tenantId, @Param("from") OffsetDateTime from,
                                     @Param("to") OffsetDateTime to, @Param("limit") int limit,
                                     @Param("offset") int offset);
}
