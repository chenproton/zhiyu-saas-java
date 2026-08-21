package org.dromara.zhiyu.mapper.lesson;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * 颗粒课 Excel 导入 SQL（对齐 Go store/exam_granular_import_export.go）。
 * 业务编排在 ImportExportServiceImpl.importGranularCourses。
 *
 * @author zhiyu
 */
public interface LessonGranularCourseImportMapper {

    @Select("SELECT id AS id, COALESCE(creator_id, '') AS creator_id, co_creator_ids AS co_creator_ids"
        + " FROM courses WHERE tenant_id = #{tenantId} AND name = #{name} AND type = 'granular' LIMIT 1")
    Map<String, Object> selectGranularCourseIdentity(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM courses WHERE tenant_id = #{tenantId} AND name = #{name} AND type = 'granular' LIMIT 1")
    String selectGranularCourseIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Update("UPDATE courses SET major_id = #{majorId}, batch_id = #{batchId}, difficulty = #{difficulty},"
        + " description = #{description}, online_hours = #{onlineHours}, knowledge_point_ids = #{knowledgePointIds},"
        + " resource_ids = #{resourceIds}, resource_count = COALESCE(JSON_LENGTH(#{resourceIds}), 0),"
        + " updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateGranularCourse(@Param("id") String id, @Param("tenantId") String tenantId,
                             @Param("majorId") String majorId, @Param("batchId") String batchId,
                             @Param("difficulty") Integer difficulty, @Param("description") String description,
                             @Param("onlineHours") Double onlineHours, @Param("knowledgePointIds") String knowledgePointIds,
                             @Param("resourceIds") String resourceIds);

    @Insert("INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,"
        + " online_hours, offline_hours, online_weight, offline_weight, semester, class_name, status, cover_color,"
        + " cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id, knowledge_point_ids,"
        + " resource_ids, node_count, resource_count, study_count)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, 'granular', 'granular', #{majorId}, NULL, NULL, 'V1.0',"
        + " #{onlineHours}, 0, 0, 0, NULL, NULL, 'draft', NULL, NULL, NULL, #{difficulty}, #{description}, #{userId},"
        + " '{}', #{batchId}, #{knowledgePointIds}, #{resourceIds}, 0,"
        + " COALESCE(JSON_LENGTH(#{resourceIds}), 0), 0)")
    int insertGranularCourse(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                             @Param("name") String name, @Param("majorId") String majorId,
                             @Param("onlineHours") Double onlineHours, @Param("difficulty") Integer difficulty,
                             @Param("description") String description, @Param("userId") String userId,
                             @Param("batchId") String batchId, @Param("knowledgePointIds") String knowledgePointIds,
                             @Param("resourceIds") String resourceIds);

    @Delete("DELETE FROM course_knowledge_bindings WHERE course_id = #{courseId} AND bind_type = 'course'")
    int deleteCourseKnowledgeBindings(@Param("courseId") String courseId);

    @Delete("DELETE FROM course_resource_bindings WHERE course_id = #{courseId}")
    int deleteCourseResourceBindings(@Param("courseId") String courseId);

    @Insert("INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)"
        + " VALUES (#{id}, #{tenantId}, #{courseId}, #{knowledgePointId}, 'course', NULL)"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertCourseKnowledgeBinding(@Param("id") String id, @Param("tenantId") String tenantId,
                                     @Param("courseId") String courseId, @Param("knowledgePointId") String knowledgePointId);

    @Insert("INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)"
        + " VALUES (#{id}, #{tenantId}, #{courseId}, #{resourceId})"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertCourseResourceBinding(@Param("id") String id, @Param("tenantId") String tenantId,
                                    @Param("courseId") String courseId, @Param("resourceId") String resourceId);

    @Select("SELECT COALESCE(MAX(substring(code from '^GRA-[0-9]{4}-([0-9]+)')), 0)"
        + " FROM courses WHERE tenant_id = #{tenantId} AND code LIKE 'GRA-' || #{year} || '-%'")
    int selectMaxGranularCourseCodeNum(@Param("tenantId") String tenantId, @Param("year") String year);

    @Select("SELECT id FROM knowledge_points WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectKnowledgePointIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO knowledge_points (id, tenant_id, name, code) VALUES (#{id}, #{tenantId}, #{name}, #{code})"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertKnowledgePoint(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                             @Param("code") String code);

    @Select("SELECT id FROM resource_library WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectResourceIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO resource_library (id, tenant_id, name, resource_type, uploaded_by)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{resourceType}, #{userId})"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertResource(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                       @Param("resourceType") String resourceType, @Param("userId") String userId);

    @Select("SELECT id FROM lesson_batches WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectLessonBatchIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT kp.name FROM knowledge_points kp JOIN course_knowledge_bindings cb ON cb.knowledge_point_id = kp.id"
        + " WHERE cb.course_id = #{courseId} AND cb.bind_type = 'course' AND cb.tenant_id = #{tenantId}"
        + " ORDER BY kp.name")
    List<String> listCourseKnowledgePointNamesForExport(@Param("courseId") String courseId, @Param("tenantId") String tenantId);

    @Select("SELECT r.name FROM resource_library r JOIN course_resource_bindings cb ON cb.resource_id = r.id"
        + " WHERE cb.course_id = #{courseId} AND cb.tenant_id = #{tenantId} ORDER BY r.name")
    List<String> listCourseResourceNamesForExport(@Param("courseId") String courseId, @Param("tenantId") String tenantId);
}
