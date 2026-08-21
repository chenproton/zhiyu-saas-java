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
 * MySQL 版：原 PG to_jsonb/jsonb_agg/jsonb_build_object 改 JSON_OBJECT / JSON_ARRAYAGG。
 *
 * @author zhiyu
 */
public interface PortalResourceSnapshotMapper extends BaseMapperPlus<PortalResourceSnapshot, PortalResourceSnapshot> {

    /** 写入快照（同版本覆盖，幂等）。 */
    @Insert("INSERT INTO resource_snapshots (tenant_id, resource_type, resource_id, version, snapshot_data)"
        + " VALUES (#{tenantId}, #{resourceType}, #{resourceId}, #{version}, CAST(#{data} AS JSON))"
        + " ON DUPLICATE KEY UPDATE snapshot_data = VALUES(snapshot_data), tenant_id = VALUES(tenant_id)")
    int saveSnapshot(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                     @Param("resourceId") String resourceId, @Param("version") String version,
                     @Param("data") String data);

    /** 按版本读取快照内容（JSON → 文本）。 */
    @Select("SELECT CAST(snapshot_data AS CHAR) FROM resource_snapshots"
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
    @Select("SELECT DISTINCT CAST(source_id AS CHAR) FROM system_course_nodes"
        + " WHERE course_id = #{courseId} AND tenant_id = #{tenantId} AND ref_type = 'original'"
        + " AND source_id IS NOT NULL")
    List<String> selectGranularCourseIds(@Param("tenantId") String tenantId, @Param("courseId") String courseId);

    /**
     * 构建课程核心 bundle（course + 节点 + 测验 + 题目 + 混合模块，snake_case 键）。
     * MySQL 版：jsonb_build_object → JSON_OBJECT；to_jsonb(t) → JSON_OBJECT(列清单)；jsonb_agg → JSON_ARRAYAGG。
     */
    @Select("SELECT JSON_OBJECT("
        + " 'course', (SELECT JSON_OBJECT('id', t.id, 'tenant_id', t.tenant_id, 'code', t.code, 'name', t.name,"
        + "   'type', t.type, 'category', t.category, 'major_id', t.major_id, 'teacher_id', t.teacher_id,"
        + "   'industry_id', t.industry_id, 'version', t.version, 'online_hours', t.online_hours,"
        + "   'offline_hours', t.offline_hours, 'online_weight', t.online_weight, 'offline_weight', t.offline_weight,"
        + "   'semester', t.semester, 'class_name', t.class_name, 'status', t.status, 'cover_color', t.cover_color,"
        + "   'cover_image', t.cover_image, 'course_tag', t.course_tag, 'difficulty', t.difficulty,"
        + "   'description', t.description, 'creator_id', t.creator_id, 'co_creator_ids', t.co_creator_ids,"
        + "   'batch_id', t.batch_id, 'knowledge_point_ids', t.knowledge_point_ids,"
        + "   'ability_point_ids', t.ability_point_ids, 'resource_ids', t.resource_ids, 'eval_data', t.eval_data,"
        + "   'node_count', t.node_count, 'resource_count', t.resource_count, 'study_count', t.study_count"
        + " ) FROM (SELECT id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,"
        + "   online_hours, offline_hours, online_weight, offline_weight, semester, class_name, status, cover_color,"
        + "   cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,"
        + "   knowledge_point_ids, ability_point_ids, resource_ids, eval_data, node_count, resource_count, study_count"
        + "   FROM courses WHERE id = #{courseId} AND tenant_id = #{tenantId}) t),"
        + " 'system_course_nodes', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'tenant_id', t.tenant_id, 'course_id', t.course_id, 'parent_id', t.parent_id,"
        + "   'name', t.name, 'code', t.code, 'sort_order', t.sort_order, 'ref_type', t.ref_type, 'source_id', t.source_id,"
        + "   'source_name', t.source_name, 'teaching_goals', t.teaching_goals,"
        + "   'detailed_description', t.detailed_description, 'description_pdf', t.description_pdf,"
        + "   'background', t.background, 'estimated_hours', t.estimated_hours, 'duration', t.duration,"
        + "   'difficulty', t.difficulty, 'knowledge_point_ids', t.knowledge_point_ids,"
        + "   'resource_ids', t.resource_ids, 'ability_point_ids', t.ability_point_ids,"
        + "   'eval_data', t.eval_data, 'status', t.status"
        + " ) ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, tenant_id, course_id, parent_id, name, code,"
        + "   sort_order, ref_type, source_id, source_name, teaching_goals, detailed_description, description_pdf,"
        + "   background, estimated_hours, duration, difficulty, knowledge_point_ids, resource_ids,"
        + "   ability_point_ids, eval_data, status FROM system_course_nodes"
        + "   WHERE course_id = #{courseId} AND tenant_id = #{tenantId}) t),"
        + " 'node_quizzes', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'node_id', t.node_id, 'title', t.title, 'type', t.type, 'time_limit', t.time_limit"
        + " ) ORDER BY t.id), '[]') FROM (SELECT id, node_id, title, type, time_limit FROM node_quizzes"
        + "   WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId})) t),"
        + " 'node_quiz_questions', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'quiz_id', t.quiz_id, 'type', t.type, 'question', t.question, 'options', t.options,"
        + "   'answer', t.answer, 'score', t.score, 'sort_order', t.sort_order"
        + " ) ORDER BY t.sort_order, t.id), '[]') FROM (SELECT id, quiz_id, type, question, options, answer, score, sort_order"
        + "   FROM node_quiz_questions WHERE quiz_id IN (SELECT id FROM node_quizzes WHERE node_id IN"
        + "   (SELECT id FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId}))) t),"
        + " 'hybrid_node_modules', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'node_id', t.node_id, 'module_key', t.module_key, 'mode', t.mode, 'data', t.data"
        + " ) ORDER BY t.id), '[]') FROM (SELECT id, node_id, module_key, mode, data FROM hybrid_node_modules"
        + "   WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId})) t)"
        + ")")
    String selectCourseCoreJson(@Param("tenantId") String tenantId, @Param("courseId") String courseId);

    /**
     * 构建课程连带引用 bundle（绑定表 + 知识点 + 资源库，snake_case 键）。
     * MySQL 版：id = ANY((SELECT array_agg(...))) 改 id IN (SELECT ...)；unnest → JSON_TABLE。
     */
    @Select("SELECT JSON_OBJECT("
        + " 'course_knowledge_bindings', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'course_id', t.course_id, 'knowledge_point_id', t.knowledge_point_id,"
        + "   'bind_type', t.bind_type, 'source_id', t.source_id"
        + " ) ORDER BY t.id), '[]') FROM (SELECT id, course_id, knowledge_point_id, bind_type, source_id"
        + "   FROM course_knowledge_bindings WHERE course_id = #{courseId}) t),"
        + " 'course_resource_bindings', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'course_id', t.course_id, 'resource_id', t.resource_id"
        + " ) ORDER BY t.id), '[]') FROM (SELECT id, course_id, resource_id FROM course_resource_bindings"
        + "   WHERE course_id = #{courseId} AND tenant_id = #{tenantId}) t),"
        + " 'node_knowledge_point_bindings', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'node_id', t.node_id, 'knowledge_point_id', t.knowledge_point_id"
        + " ) ORDER BY t.id), '[]') FROM (SELECT id, node_id, knowledge_point_id FROM node_knowledge_point_bindings"
        + "   WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId})) t),"
        + " 'node_resource_bindings', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'node_id', t.node_id, 'resource_id', t.resource_id"
        + " ) ORDER BY t.id), '[]') FROM (SELECT id, node_id, resource_id FROM node_resource_bindings"
        + "   WHERE node_id IN (SELECT id FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId})) t),"
        + " 'knowledge_points', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'name', t.name, 'code', t.code, 'description', t.description, 'linked', t.linked,"
        + "   'granular_lesson_ids', t.granular_lesson_ids, 'creator_id', t.creator_id,"
        + "   'source_type', t.source_type, 'source_id', t.source_id, 'created_at', t.created_at, 'updated_at', t.updated_at"
        + " ) ORDER BY t.id), '[]') FROM (SELECT id, name, code, description, linked, granular_lesson_ids, creator_id,"
        + "   source_type, source_id, created_at, updated_at"
        + "   FROM knowledge_points WHERE tenant_id = #{tenantId} AND id IN ("
        + "   SELECT jt.x FROM courses c JOIN JSON_TABLE(c.knowledge_point_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + "     WHERE c.id = #{courseId}"
        + "   UNION SELECT ckb.knowledge_point_id FROM course_knowledge_bindings ckb WHERE ckb.course_id = #{courseId}"
        + "   UNION SELECT jt.x FROM system_course_nodes n JOIN JSON_TABLE(n.knowledge_point_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + "     WHERE n.course_id = #{courseId} AND n.tenant_id = #{tenantId}"
        + "   UNION SELECT nkpb.knowledge_point_id FROM node_knowledge_point_bindings nkpb WHERE nkpb.node_id IN"
        + "     (SELECT id FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId})) t),"
        + " 'resource_library', (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT("
        + "   'id', t.id, 'tenant_id', t.tenant_id, 'name', t.name, 'resource_type', t.resource_type,"
        + "   'url', t.url, 'description', t.description, 'thumbnail', t.thumbnail, 'file_size', t.file_size,"
        + "   'metadata', t.metadata, 'uploaded_by', t.uploaded_by, 'created_at', t.created_at, 'updated_at', t.updated_at"
        + " ) ORDER BY t.id), '[]') FROM (SELECT id, tenant_id, name, resource_type, url, description, thumbnail,"
        + "   file_size, metadata, uploaded_by, created_at, updated_at"
        + "   FROM resource_library WHERE tenant_id = #{tenantId} AND id IN ("
        + "   SELECT jt.x FROM courses c JOIN JSON_TABLE(c.resource_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + "     WHERE c.id = #{courseId}"
        + "   UNION SELECT crb.resource_id FROM course_resource_bindings crb"
        + "     WHERE crb.course_id = #{courseId} AND crb.tenant_id = #{tenantId}"
        + "   UNION SELECT jt.x FROM system_course_nodes n JOIN JSON_TABLE(n.resource_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt"
        + "     WHERE n.course_id = #{courseId} AND n.tenant_id = #{tenantId}"
        + "   UNION SELECT nrb.resource_id FROM node_resource_bindings nrb WHERE nrb.node_id IN"
        + "     (SELECT id FROM system_course_nodes WHERE course_id = #{courseId} AND tenant_id = #{tenantId})) t)"
        + ")")
    String selectCourseRefsJson(@Param("tenantId") String tenantId, @Param("courseId") String courseId);
}
