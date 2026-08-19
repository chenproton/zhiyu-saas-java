package org.dromara.zhiyu.mapper.lesson;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * 体系课 Excel 导入 SQL（对齐 Go store/course_import_export.go）。
 * 业务编排（课程+节点树拓扑排序）在 ImportExportServiceImpl.importCourses。
 *
 * @author zhiyu
 */
public interface LessonCourseImportMapper {

    // ---------- 课程 ----------

    @Select("SELECT id::text AS id, COALESCE(creator_id::text, '') AS creator_id, co_creator_ids::text AS co_creator_ids"
        + " FROM courses WHERE tenant_id = #{tenantId}::uuid AND name = #{name} AND type = 'system' LIMIT 1")
    Map<String, Object> selectSystemCourseIdentity(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id::text FROM courses WHERE tenant_id = #{tenantId}::uuid AND name = #{name} AND type = 'system' LIMIT 1")
    String selectSystemCourseIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Update("UPDATE courses SET major_id = #{majorId}::uuid, batch_id = #{batchId}::uuid, description = #{description},"
        + " ability_point_ids = #{abilityPointIds}, updated_at = NOW() WHERE id = #{id}::uuid AND tenant_id = #{tenantId}::uuid")
    int updateSystemCourseOverwrite(@Param("id") String id, @Param("tenantId") String tenantId,
                                    @Param("majorId") String majorId, @Param("batchId") String batchId,
                                    @Param("description") String description, @Param("abilityPointIds") String abilityPointIds);

    @Insert("INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,"
        + " online_hours, offline_hours, online_weight, offline_weight, semester, class_name, status, cover_color,"
        + " cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id, ability_point_ids,"
        + " node_count, resource_count, study_count)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{code}, #{name}, 'system', 'system', #{majorId}::uuid, NULL, NULL, 'V1.0',"
        + " 0, 0, 0, 0, NULL, NULL, 'draft', NULL, NULL, NULL, NULL, #{description}, #{creatorId}::uuid, '{}',"
        + " #{batchId}::uuid, #{abilityPointIds}, 0, 0, 0)")
    int insertSystemCourse(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                           @Param("name") String name, @Param("majorId") String majorId,
                           @Param("description") String description, @Param("creatorId") String creatorId,
                           @Param("batchId") String batchId, @Param("abilityPointIds") String abilityPointIds);

    // ---------- 节点 ----------

    @Insert("INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, sort_order, ref_type,"
        + " source_id, source_name, teaching_goals, duration, difficulty, knowledge_point_ids, resource_ids, status)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{courseId}::uuid, #{parentId}::uuid, #{name}, #{sortOrder}, #{refType},"
        + " #{sourceId}::uuid, #{sourceName}, #{teachingGoals}, #{duration}, #{difficulty}, '{}', '{}', 'draft')")
    int insertCourseNode(@Param("id") String id, @Param("tenantId") String tenantId, @Param("courseId") String courseId,
                         @Param("parentId") String parentId, @Param("name") String name, @Param("sortOrder") Integer sortOrder,
                         @Param("refType") String refType, @Param("sourceId") String sourceId,
                         @Param("sourceName") String sourceName, @Param("teachingGoals") String teachingGoals,
                         @Param("duration") Integer duration, @Param("difficulty") Integer difficulty);

    @Insert("INSERT INTO node_knowledge_point_bindings (id, node_id, knowledge_point_id, created_at)"
        + " VALUES (#{id}, #{nodeId}::uuid, #{kpId}::uuid, NOW()) ON CONFLICT (node_id, knowledge_point_id) DO NOTHING")
    int insertNodeKnowledgeBinding(@Param("id") String id, @Param("nodeId") String nodeId, @Param("kpId") String kpId);

    @Insert("INSERT INTO node_resource_bindings (id, tenant_id, node_id, resource_id, created_at)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{nodeId}::uuid, #{resId}::uuid, NOW())"
        + " ON CONFLICT (node_id, resource_id) DO NOTHING")
    int insertNodeResourceBinding(@Param("id") String id, @Param("tenantId") String tenantId,
                                  @Param("nodeId") String nodeId, @Param("resId") String resId);

    @Update("UPDATE system_course_nodes SET knowledge_point_ids = COALESCE(#{kpIds}::uuid[], '{}'),"
        + " resource_ids = COALESCE(#{resIds}::uuid[], '{}') WHERE id = #{nodeId}::uuid")
    int updateNodeBindingArrays(@Param("nodeId") String nodeId, @Param("kpIds") String kpIds,
                                @Param("resIds") String resIds);

    @Insert("INSERT INTO node_quizzes (id, tenant_id, node_id, title, type)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{nodeId}::uuid, #{title}, #{methodKey})")
    int insertNodeQuiz(@Param("id") String id, @Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                       @Param("title") String title, @Param("methodKey") String methodKey);

    @Delete("DELETE FROM node_quizzes WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id = #{courseId}::uuid)")
    int deleteNodeQuizzesByCourse(@Param("courseId") String courseId);

    @Delete("DELETE FROM system_course_nodes WHERE course_id = #{courseId}::uuid")
    int deleteCourseNodes(@Param("courseId") String courseId);

    // ---------- 引用查找 ----------

    @Select("SELECT id::text FROM ability_points WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String selectAbilityPointIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id::text AS id, name, online_hours, COALESCE(description,'') AS description, difficulty"
        + " FROM courses WHERE tenant_id = #{tenantId}::uuid AND name = #{name} AND type = 'granular' LIMIT 1")
    Map<String, Object> selectGranularCourseByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT knowledge_point_id::text FROM course_knowledge_bindings WHERE course_id = #{courseId}::uuid AND bind_type = 'course'")
    List<String> selectGranularCourseKnowledgePointIds(@Param("courseId") String courseId);

    @Select("SELECT resource_id::text FROM course_resource_bindings WHERE course_id = #{courseId}::uuid")
    List<String> selectGranularCourseResourceIds(@Param("courseId") String courseId);

    // ---------- 导出 ----------

    @Select("SELECT COALESCE((SELECT string_agg(ap.name, ',' ORDER BY ap.name)"
        + " FROM ability_points ap WHERE ap.id = ANY(c.ability_point_ids)), '')"
        + " FROM courses c WHERE c.id = #{courseId}::uuid")
    String selectCourseAbilityPointNames(@Param("courseId") String courseId);

    @Select("SELECT id::text AS id, name, COALESCE(parent_id::text, '') AS parent_id, COALESCE(ref_type, '') AS ref_type,"
        + " sort_order, COALESCE(teaching_goals, '') AS teaching_goals, duration, difficulty"
        + " FROM system_course_nodes WHERE course_id = #{courseId}::uuid AND tenant_id = #{tenantId}::uuid"
        + " ORDER BY sort_order, created_at")
    List<Map<String, Object>> listCourseNodes(@Param("tenantId") String tenantId, @Param("courseId") String courseId);

    @Select("SELECT kp.name FROM knowledge_points kp JOIN node_knowledge_point_bindings nb ON nb.knowledge_point_id = kp.id"
        + " WHERE nb.node_id = #{nodeId}::uuid ORDER BY kp.name")
    List<String> listNodeKnowledgePointNames(@Param("nodeId") String nodeId);

    @Select("SELECT r.name FROM resource_library r JOIN node_resource_bindings nb ON nb.resource_id = r.id"
        + " WHERE nb.node_id = #{nodeId}::uuid ORDER BY r.name")
    List<String> listNodeResourceNames(@Param("nodeId") String nodeId);

    @Select("SELECT type::text FROM node_quizzes WHERE node_id = #{nodeId}::uuid AND tenant_id = #{tenantId}::uuid"
        + " ORDER BY type")
    List<String> listNodeEvalMethods(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId);
}
