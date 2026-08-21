package org.dromara.zhiyu.mapper.lesson;

import lombok.Data;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeEnrichResourceDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeKnowledgePointDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.NodeQuizDto;
import org.dromara.zhiyu.domain.lesson.SystemCourseNode;

import java.math.BigDecimal;
import java.util.List;

/**
 * 体系课节点 Mapper（system_course_nodes 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface SystemCourseNodeMapper extends BaseMapperPlus<SystemCourseNode, SystemCourseNode> {

    /** 查询节点租户（归属校验用）。 */
    @Select("SELECT tenant_id FROM system_course_nodes WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    /** 查询节点所属课程（节点资源归属校验用）。 */
    @Select("SELECT course_id FROM system_course_nodes WHERE id = #{id}")
    String selectCourseIdOf(@Param("id") String id);

    /** 节点删除保护：存在测评成绩或节点考试结果时拒绝删除。 */
    @Select("SELECT EXISTS(SELECT 1 FROM node_evaluation_results WHERE node_id = #{id})"
        + " OR EXISTS(SELECT 1 FROM exam_results er JOIN exam_usages eu ON eu.id = er.exam_usage_id"
        + " WHERE eu.target_type = 'node' AND JSON_CONTAINS(eu.target_ids, JSON_QUOTE(#{id}), '$'))")
    boolean existsEvaluationResults(@Param("id") String id);

    /** 创建节点（事务内，含数组/JSON 列）。 */
    @Insert("INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, code, sort_order, ref_type,"
        + " source_id, source_name, teaching_goals, detailed_description, description_pdf, background, estimated_hours,"
        + " duration, difficulty, knowledge_point_ids, resource_ids, eval_data, status)"
        + " VALUES (#{id}, #{tenantId}, #{courseId}, #{parentId}, #{name}, #{code}, #{sortOrder},"
        + " #{refType}, #{sourceId}, #{sourceName}, #{teachingGoals}, #{detailedDescription}, #{descriptionPdf},"
        + " #{background}, #{estimatedHours}, #{duration}, #{difficulty},"
        + " #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " CAST(#{evalData} AS JSON), #{status})")
    int insertNode(@Param("id") String id, @Param("tenantId") String tenantId, @Param("courseId") String courseId,
                   @Param("parentId") String parentId, @Param("name") String name, @Param("code") String code,
                   @Param("sortOrder") Integer sortOrder, @Param("refType") String refType,
                   @Param("sourceId") String sourceId, @Param("sourceName") String sourceName,
                   @Param("teachingGoals") String teachingGoals, @Param("detailedDescription") String detailedDescription,
                   @Param("descriptionPdf") String descriptionPdf, @Param("background") String background,
                   @Param("estimatedHours") BigDecimal estimatedHours, @Param("duration") Integer duration,
                   @Param("difficulty") Integer difficulty, @Param("knowledgePointIds") List<String> knowledgePointIds,
                   @Param("resourceIds") List<String> resourceIds, @Param("evalData") String evalData,
                   @Param("status") String status);

    /** 更新节点（限定租户）。 */
    @Update("UPDATE system_course_nodes SET name = #{name}, code = #{code}, sort_order = #{sortOrder},"
        + " ref_type = #{refType}, source_id = #{sourceId}, source_name = #{sourceName},"
        + " teaching_goals = #{teachingGoals}, detailed_description = #{detailedDescription},"
        + " description_pdf = #{descriptionPdf}, background = #{background}, estimated_hours = #{estimatedHours},"
        + " duration = #{duration}, difficulty = #{difficulty},"
        + " knowledge_point_ids = #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " resource_ids = #{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " eval_data = CAST(#{evalData} AS JSON), status = #{status}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateNode(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                   @Param("code") String code, @Param("sortOrder") Integer sortOrder, @Param("refType") String refType,
                   @Param("sourceId") String sourceId, @Param("sourceName") String sourceName,
                   @Param("teachingGoals") String teachingGoals, @Param("detailedDescription") String detailedDescription,
                   @Param("descriptionPdf") String descriptionPdf, @Param("background") String background,
                   @Param("estimatedHours") BigDecimal estimatedHours, @Param("duration") Integer duration,
                   @Param("difficulty") Integer difficulty, @Param("knowledgePointIds") List<String> knowledgePointIds,
                   @Param("resourceIds") List<String> resourceIds, @Param("evalData") String evalData,
                   @Param("status") String status);

    /** 删除节点（限定租户）。 */
    @Delete("DELETE FROM system_course_nodes WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteNode(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 更新节点评估配置（发布测评生成写回 methodResourceConfigs 用，对齐 Go UpdateNodeEvalData）。 */
    @Update("UPDATE system_course_nodes SET eval_data = CAST(#{evalData} AS JSON), updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateNodeEvalData(@Param("id") String id, @Param("tenantId") String tenantId,
                           @Param("evalData") String evalData);

    /** 单节点重排。 */
    @Update("UPDATE system_course_nodes SET sort_order = #{sortOrder}, updated_at = NOW()"
        + " WHERE id = #{id} AND course_id = #{courseId}")
    int reorderNode(@Param("id") String id, @Param("courseId") String courseId, @Param("sortOrder") int sortOrder);

    /** 节点知识点绑定清理。 */
    @Delete("DELETE FROM node_knowledge_point_bindings WHERE node_id = #{nodeId}")
    int deleteNodeKnowledgeBindings(@Param("nodeId") String nodeId);

    /** 节点知识点绑定插入。 */
    @Insert("INSERT INTO node_knowledge_point_bindings (id, node_id, knowledge_point_id)"
        + " VALUES ((UUID()), #{nodeId}, #{kpId})")
    int insertNodeKnowledgeBinding(@Param("nodeId") String nodeId, @Param("kpId") String kpId);

    /** 节点资源绑定清理。 */
    @Delete("DELETE FROM node_resource_bindings WHERE node_id = #{nodeId}")
    int deleteNodeResourceBindings(@Param("nodeId") String nodeId);

    /** 节点资源绑定插入。 */
    @Insert("INSERT INTO node_resource_bindings (id, node_id, resource_id)"
        + " VALUES ((UUID()), #{nodeId}, #{resourceId})")
    int insertNodeResourceBinding(@Param("nodeId") String nodeId, @Param("resourceId") String resourceId);

    /** 批量查询知识点（enrich 用）。 */
    @Select("SELECT kp.id, kp.name, kp.code, kp.description, kp.linked FROM knowledge_points kp"
        + " WHERE JSON_CONTAINS(CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(kp.id), '$')")
    List<NodeKnowledgePointDto> selectKnowledgePointsByIds(@Param("ids") List<String> ids);

    /** 批量查询资源（enrich 用）。 */
    @Select("SELECT rl.id, rl.name, rl.resource_type AS type, COALESCE(rl.url, '') AS url,"
        + " COALESCE(rl.file_size, 0) AS size FROM resource_library rl"
        + " WHERE JSON_CONTAINS(CAST(#{ids, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(rl.id), '$')")
    List<NodeEnrichResourceDto> selectResourcesByIds(@Param("ids") List<String> ids);

    /** 批量查询节点测验（enrich 用）。 */
    @Select("SELECT id, node_id, title, type, time_limit FROM node_quizzes"
        + " WHERE JSON_CONTAINS(CAST(#{nodeIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(node_id), '$')"
        + " ORDER BY id ASC")
    List<NodeQuizDto> selectQuizzesByNodeIds(@Param("nodeIds") List<String> nodeIds);

    /** original 节点来源颗粒课知识点行。 */
    @Data
    class OriginalKpRow {
        private String courseId;
        private String id;
        private String name;
        private String code;
        private String description;
        private Boolean linked;
    }

    /** original 节点来源颗粒课资源行。 */
    @Data
    class OriginalResRow {
        private String courseId;
        private String id;
        private String name;
        private String type;
        private String url;
        private Integer size;
    }

    /** 查询 original 节点来源颗粒课的知识点（course 绑定）。 */
    @Select("SELECT ckb.course_id, kp.id, kp.name, kp.code, kp.description, TRUE AS linked"
        + " FROM course_knowledge_bindings ckb JOIN knowledge_points kp ON kp.id = ckb.knowledge_point_id"
        + " WHERE JSON_CONTAINS(CAST(#{courseIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(ckb.course_id), '$')"
        + " AND ckb.bind_type = 'course'")
    List<OriginalKpRow> selectOriginalSourceKnowledgePoints(@Param("courseIds") List<String> courseIds);

    /** 查询 original 节点来源颗粒课的资源（course 绑定）。 */
    @Select("SELECT crb.course_id, rl.id, rl.name, rl.resource_type AS type, COALESCE(rl.url, '') AS url,"
        + " COALESCE(rl.file_size, 0) AS size"
        + " FROM course_resource_bindings crb JOIN resource_library rl ON rl.id = crb.resource_id"
        + " WHERE JSON_CONTAINS(CAST(#{courseIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler} AS JSON), JSON_QUOTE(crb.course_id), '$')")
    List<OriginalResRow> selectOriginalSourceResources(@Param("courseIds") List<String> courseIds);

    /** 课程节点数行（列表组装 node_count 用）。 */
    @Data
    class NodeCountRow {
        private String courseId;
        private Long cnt;
    }

    /** 批量统计课程节点数（防 N+1）。 */
    @Select("<script>SELECT course_id AS course_id, COUNT(*) AS cnt FROM system_course_nodes"
        + " WHERE course_id IN <foreach collection='courseIds' item='c' open='(' separator=',' close=')'>#{c}</foreach>"
        + " GROUP BY course_id</script>")
    List<NodeCountRow> countNodesByCourseIds(@Param("courseIds") List<String> courseIds);
}
