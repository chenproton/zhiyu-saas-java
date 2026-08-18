package org.dromara.zhiyu.mapper.portal;

import lombok.Data;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.portal.PortalResourceSnapshot;

import java.util.List;

/**
 * 资源快照 Mapper（resource_snapshots 表，Go snapshot_builders.go 课程快照语义）。
 *
 * @author zhiyu
 */
public interface PortalResourceSnapshotMapper extends BaseMapperPlus<PortalResourceSnapshot, PortalResourceSnapshot> {

    String COURSE_COLUMNS = "id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,"
        + " online_hours, offline_hours, online_weight, offline_weight, semester, class_name, status, cover_color,"
        + " cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,"
        + " knowledge_point_ids, ability_point_ids, resource_ids, eval_data, node_count, resource_count, study_count";

    String NODE_COLUMNS = "id, tenant_id, course_id, parent_id, name, code, sort_order, ref_type, source_id,"
        + " source_name, teaching_goals, detailed_description, description_pdf, background, estimated_hours,"
        + " duration, difficulty, knowledge_point_ids, resource_ids, ability_point_ids, eval_data, status";

    String NODE_IDS_SUB = "SELECT id FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId}";

    /** 写入快照（同版本覆盖，幂等）。 */
    @Insert("INSERT INTO resource_snapshots (tenant_id, resource_type, resource_id, version, snapshot_data)"
        + " VALUES (#{tenantId}, #{resourceType}, #{resourceId}, #{version}, CAST(#{data} AS jsonb))"
        + " ON CONFLICT ON CONSTRAINT uq_resource_snapshots"
        + " DO UPDATE SET snapshot_data = EXCLUDED.snapshot_data, tenant_id = EXCLUDED.tenant_id")
    int saveSnapshot(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                     @Param("resourceId") String resourceId, @Param("version") String version,
                     @Param("data") String data);

    /** 按版本读取快照内容（jsonb → 文本）。 */
    @Select("SELECT snapshot_data::text FROM resource_snapshots"
        + " WHERE tenant_id = #{tenantId} AND resource_type = #{resourceType} AND resource_id = #{resourceId}"
        + " AND version = #{version}")
    String selectSnapshotData(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                              @Param("resourceId") String resourceId, @Param("version") String version);

    /** 最新快照版本号（无快照返回 null）。 */
    @Select("SELECT version FROM resource_snapshots"
        + " WHERE tenant_id = #{tenantId} AND resource_type = #{resourceType} AND resource_id = #{resourceId}"
        + " ORDER BY created_at DESC, id DESC LIMIT 1")
    String selectLatestVersion(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                               @Param("resourceId") String resourceId);

    /** 课程 live 版本与状态。 */
    @Data
    class LiveStateRow {
        private String version;
        private String status;
    }

    @Select("SELECT COALESCE(version, '') AS version, status FROM courses"
        + " WHERE tenant_id = #{tenantId} AND id = #{courseId}")
    LiveStateRow selectCourseLiveState(@Param("tenantId") String tenantId, @Param("courseId") String courseId);

    /** 颗粒课一层：节点 ref_type='original' 的 source_id 列表。 */
    @Select("SELECT DISTINCT source_id::text FROM system_course_nodes"
        + " WHERE course_id = #{courseId} AND tenant_id = #{tenantId} AND ref_type = 'original'"
        + " AND source_id IS NOT NULL")
    List<String> selectGranularCourseIds(@Param("tenantId") String tenantId, @Param("courseId") String courseId);

    /** 构建课程核心 bundle（course + 节点 + 测验 + 题目 + 混合模块，snake_case 键）。 */
    @Select("SELECT jsonb_build_object("
        + "'course', (SELECT to_jsonb(t) FROM (SELECT " + COURSE_COLUMNS + " FROM courses WHERE id = #{courseId} AND tenant_id = #{tenantId}) t),"
        + "'system_course_nodes', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)"
        + " FROM (SELECT " + NODE_COLUMNS + " FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId}) t),"
        + "'node_quizzes', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)"
        + " FROM (SELECT id, node_id, title, type, time_limit FROM node_quizzes WHERE node_id IN (" + NODE_IDS_SUB + ")) t),"
        + "'node_quiz_questions', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)"
        + " FROM (SELECT id, quiz_id, type, question, options, answer, score, sort_order FROM node_quiz_questions"
        + " WHERE quiz_id IN (SELECT id FROM node_quizzes WHERE node_id IN (" + NODE_IDS_SUB + "))) t),"
        + "'hybrid_node_modules', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)"
        + " FROM (SELECT id, node_id, module_key, mode, data FROM hybrid_node_modules WHERE node_id IN (" + NODE_IDS_SUB + ")) t)"
        + ")::text")
    String selectCourseCoreJson(@Param("tenantId") String tenantId, @Param("courseId") String courseId);

    /** 构建课程连带引用 bundle（绑定表 + 知识点 + 资源库，snake_case 键）。 */
    @Select("SELECT jsonb_build_object("
        + "'course_knowledge_bindings', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)"
        + " FROM (SELECT id, course_id, knowledge_point_id, bind_type, source_id FROM course_knowledge_bindings WHERE course_id = #{courseId}) t),"
        + "'course_resource_bindings', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)"
        + " FROM (SELECT id, course_id, resource_id FROM course_resource_bindings WHERE course_id = #{courseId} AND tenant_id = #{tenantId}) t),"
        + "'node_knowledge_point_bindings', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)"
        + " FROM (SELECT id, node_id, knowledge_point_id FROM node_knowledge_point_bindings WHERE node_id IN (" + NODE_IDS_SUB + ")) t),"
        + "'node_resource_bindings', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)"
        + " FROM (SELECT id, node_id, resource_id FROM node_resource_bindings WHERE node_id IN (" + NODE_IDS_SUB + ")) t),"
        + "'knowledge_points', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)"
        + " FROM (SELECT id, name, code, description, linked, granular_lesson_ids, creator_id, source_type, source_id, created_at, updated_at"
        + " FROM knowledge_points WHERE id = ANY((SELECT COALESCE(array_agg(DISTINCT x), '{}') FROM ("
        + " SELECT unnest(c.knowledge_point_ids) AS x FROM courses c WHERE c.id = #{courseId}"
        + " UNION SELECT ckb.knowledge_point_id FROM course_knowledge_bindings ckb WHERE ckb.course_id = #{courseId}"
        + " UNION SELECT unnest(n.knowledge_point_ids) FROM system_course_nodes n WHERE n.course_id = #{courseId} AND n.tenant_id = #{tenantId}"
        + " UNION SELECT nkpb.knowledge_point_id FROM node_knowledge_point_bindings nkpb WHERE nkpb.node_id IN (" + NODE_IDS_SUB + ")"
        + " ) u)) AND tenant_id = #{tenantId}) t),"
        + "'resource_library', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)"
        + " FROM (SELECT id, tenant_id, name, resource_type, url, description, thumbnail, file_size, metadata, uploaded_by, created_at, updated_at"
        + " FROM resource_library WHERE id = ANY((SELECT COALESCE(array_agg(DISTINCT x), '{}') FROM ("
        + " SELECT unnest(c.resource_ids) AS x FROM courses c WHERE c.id = #{courseId}"
        + " UNION SELECT crb.resource_id FROM course_resource_bindings crb WHERE crb.course_id = #{courseId} AND crb.tenant_id = #{tenantId}"
        + " UNION SELECT unnest(n.resource_ids) FROM system_course_nodes n WHERE n.course_id = #{courseId} AND n.tenant_id = #{tenantId}"
        + " UNION SELECT nrb.resource_id FROM node_resource_bindings nrb WHERE nrb.node_id IN (" + NODE_IDS_SUB + ")"
        + " ) u)) AND tenant_id = #{tenantId}) t)"
        + ")::text")
    String selectCourseRefsJson(@Param("tenantId") String tenantId, @Param("courseId") String courseId);
}
