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

    @Select("SELECT id AS id, COALESCE(creator_id, '') AS creator_id, co_creator_ids AS co_creator_ids"
        + " FROM courses WHERE tenant_id = #{tenantId} AND name = #{name} AND type = 'system' LIMIT 1")
    Map<String, Object> selectSystemCourseIdentity(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM courses WHERE tenant_id = #{tenantId} AND name = #{name} AND type = 'system' LIMIT 1")
    String selectSystemCourseIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Update("UPDATE courses SET major_id = #{majorId}, batch_id = #{batchId}, description = #{description},"
        + " ability_point_ids = #{abilityPointIds}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateSystemCourseOverwrite(@Param("id") String id, @Param("tenantId") String tenantId,
                                    @Param("majorId") String majorId, @Param("batchId") String batchId,
                                    @Param("description") String description, @Param("abilityPointIds") String abilityPointIds);

    @Insert("INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,"
        + " online_hours, offline_hours, online_weight, offline_weight, semester, class_name, status, cover_color,"
        + " cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id, ability_point_ids,"
        + " node_count, resource_count, study_count)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, 'system', 'system', #{majorId}, NULL, NULL, 'V1.0',"
        + " 0, 0, 0, 0, NULL, NULL, 'draft', NULL, NULL, NULL, NULL, #{description}, #{creatorId}, JSON_ARRAY(),"
        + " #{batchId}, #{abilityPointIds}, 0, 0, 0)")
    int insertSystemCourse(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                           @Param("name") String name, @Param("majorId") String majorId,
                           @Param("description") String description, @Param("creatorId") String creatorId,
                           @Param("batchId") String batchId, @Param("abilityPointIds") String abilityPointIds);

    // ---------- 节点 ----------

    @Insert("INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, sort_order, ref_type,"
        + " source_id, source_name, teaching_goals, duration, difficulty, knowledge_point_ids, resource_ids, status)"
        + " VALUES (#{id}, #{tenantId}, #{courseId}, #{parentId}, #{name}, #{sortOrder}, #{refType},"
        + " #{sourceId}, #{sourceName}, #{teachingGoals}, #{duration}, #{difficulty}, JSON_ARRAY(), JSON_ARRAY(), 'draft')")
    int insertCourseNode(@Param("id") String id, @Param("tenantId") String tenantId, @Param("courseId") String courseId,
                         @Param("parentId") String parentId, @Param("name") String name, @Param("sortOrder") Integer sortOrder,
                         @Param("refType") String refType, @Param("sourceId") String sourceId,
                         @Param("sourceName") String sourceName, @Param("teachingGoals") String teachingGoals,
                         @Param("duration") Integer duration, @Param("difficulty") Integer difficulty);

    @Insert("INSERT INTO node_knowledge_point_bindings (id, node_id, knowledge_point_id, created_at)"
        + " VALUES (#{id}, #{nodeId}, #{kpId}, NOW()) ON DUPLICATE KEY UPDATE id = id")
    int insertNodeKnowledgeBinding(@Param("id") String id, @Param("nodeId") String nodeId, @Param("kpId") String kpId);

    @Insert("INSERT INTO node_resource_bindings (id, tenant_id, node_id, resource_id, created_at)"
        + " VALUES (#{id}, #{tenantId}, #{nodeId}, #{resId}, NOW())"
        + " ON DUPLICATE KEY UPDATE id = id")
    int insertNodeResourceBinding(@Param("id") String id, @Param("tenantId") String tenantId,
                                  @Param("nodeId") String nodeId, @Param("resId") String resId);

    @Update("UPDATE system_course_nodes SET knowledge_point_ids = COALESCE(#{kpIds}, JSON_ARRAY()),"
        + " resource_ids = COALESCE(#{resIds}, JSON_ARRAY()) WHERE id = #{nodeId}")
    int updateNodeBindingArrays(@Param("nodeId") String nodeId, @Param("kpIds") String kpIds,
                                @Param("resIds") String resIds);

    @Insert("INSERT INTO node_quizzes (id, tenant_id, node_id, title, type)"
        + " VALUES (#{id}, #{tenantId}, #{nodeId}, #{title}, #{methodKey})")
    int insertNodeQuiz(@Param("id") String id, @Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                       @Param("title") String title, @Param("methodKey") String methodKey);

    @Delete("DELETE FROM node_quizzes WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id = #{courseId})")
    int deleteNodeQuizzesByCourse(@Param("courseId") String courseId);

    @Delete("DELETE FROM system_course_nodes WHERE course_id = #{courseId}")
    int deleteCourseNodes(@Param("courseId") String courseId);

    // ---------- 引用查找 ----------

    @Select("SELECT id FROM ability_points WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectAbilityPointIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id AS id, name, online_hours, COALESCE(description,'') AS description, difficulty"
        + " FROM courses WHERE tenant_id = #{tenantId} AND name = #{name} AND type = 'granular' LIMIT 1")
    Map<String, Object> selectGranularCourseByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT knowledge_point_id FROM course_knowledge_bindings WHERE course_id = #{courseId} AND bind_type = 'course'")
    List<String> selectGranularCourseKnowledgePointIds(@Param("courseId") String courseId);

    @Select("SELECT resource_id FROM course_resource_bindings WHERE course_id = #{courseId}")
    List<String> selectGranularCourseResourceIds(@Param("courseId") String courseId);

    // ---------- 导出 ----------

    @Select("SELECT COALESCE((SELECT GROUP_CONCAT(ap.name ORDER BY ap.name SEPARATOR ',')"
        + " FROM ability_points ap WHERE JSON_CONTAINS(c.ability_point_ids, JSON_QUOTE(ap.id), '$')), '')"
        + " FROM courses c WHERE c.id = #{courseId}")
    String selectCourseAbilityPointNames(@Param("courseId") String courseId);

    @Select("SELECT id AS id, name, COALESCE(parent_id, '') AS parent_id, COALESCE(ref_type, '') AS ref_type,"
        + " sort_order, COALESCE(teaching_goals, '') AS teaching_goals, duration, difficulty"
        + " FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId}"
        + " ORDER BY sort_order, created_at")
    List<Map<String, Object>> listCourseNodes(@Param("tenantId") String tenantId, @Param("courseId") String courseId);

    @Select("SELECT kp.name FROM knowledge_points kp JOIN node_knowledge_point_bindings nb ON nb.knowledge_point_id = kp.id"
        + " WHERE nb.node_id = #{nodeId} AND kp.tenant_id = #{tenantId} ORDER BY kp.name")
    List<String> listNodeKnowledgePointNames(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId);

    @Select("SELECT r.name FROM resource_library r JOIN node_resource_bindings nb ON nb.resource_id = r.id"
        + " WHERE nb.node_id = #{nodeId} AND r.tenant_id = #{tenantId} ORDER BY r.name")
    List<String> listNodeResourceNames(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId);

    @Select("SELECT type FROM node_quizzes WHERE node_id = #{nodeId} AND tenant_id = #{tenantId}"
        + " ORDER BY type")
    List<String> listNodeEvalMethods(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId);
}
