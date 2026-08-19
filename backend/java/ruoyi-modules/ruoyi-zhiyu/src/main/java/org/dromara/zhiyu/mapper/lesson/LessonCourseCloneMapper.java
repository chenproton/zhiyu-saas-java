package org.dromara.zhiyu.mapper.lesson;

import lombok.Data;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.lesson.LessonCourse;

import java.math.BigDecimal;
import java.util.List;

/**
 * 课程克隆 Mapper（courses 克隆多表复制，Go store/course_clone.go 语义）。
 *
 * @author zhiyu
 */
public interface LessonCourseCloneMapper extends BaseMapperPlus<LessonCourse, LessonCourse> {

    /** 克隆源课程行（名称/类型/租户，供编码前缀与归属校验）。 */
    @Data
    class SourceCourseRow {
        private String name;
        private String type;
        private String tenantId;
    }

    /** 克隆源节点行。 */
    @Data
    class NodeSourceRow {
        private String id;
        private String parentId;
        private String name;
        private String code;
        private Integer sortOrder;
        private String refType;
        private String sourceId;
        private String sourceName;
        private String teachingGoals;
        private String detailedDescription;
        private String descriptionPdf;
        private String background;
        private BigDecimal estimatedHours;
        private Integer duration;
        private Integer difficulty;
        private List<String> knowledgePointIds;
        private List<String> resourceIds;
        private List<String> abilityPointIds;
        private String evalData;
        private String status;
    }

    /** 克隆源测验行。 */
    @Data
    class QuizSourceRow {
        private String id;
        private String nodeId;
        private String title;
        private String type;
        private Integer timeLimit;
    }

    /** 克隆源测验题目行。 */
    @Data
    class QuestionSourceRow {
        private String quizId;
        private String type;
        private String question;
        private String options;
        private String answer;
        private BigDecimal score;
        private Integer sortOrder;
    }

    /** 克隆源混合模块行。 */
    @Data
    class HybridSourceRow {
        private String nodeId;
        private String moduleKey;
        private String mode;
        private String data;
    }

    @Select("SELECT name, type, COALESCE(tenant_id::text, '') AS tenant_id FROM courses WHERE id = #{id}")
    SourceCourseRow selectSource(@Param("id") String id);

    /** 克隆课程主表（复制全部业务字段，status 重置 draft，计数归零）。 */
    @Insert("INSERT INTO courses (id, tenant_id, code, name, type, category, major_id, teacher_id, industry_id, version,"
        + " online_hours, offline_hours, online_weight, offline_weight, semester, class_name,"
        + " status, cover_color, cover_image, course_tag, difficulty, description, creator_id, co_creator_ids, batch_id,"
        + " knowledge_point_ids, ability_point_ids, resource_ids, eval_data, node_count, resource_count, study_count)"
        + " SELECT #{newId}, #{tenantId}, #{code}, #{newName}, type, category, major_id, teacher_id, industry_id, version,"
        + " online_hours, offline_hours, online_weight, offline_weight, semester, class_name,"
        + " 'draft', cover_color, cover_image, course_tag, difficulty, description, #{creatorId}::uuid, co_creator_ids, batch_id,"
        + " knowledge_point_ids, ability_point_ids, resource_ids, eval_data, 0, 0, 0"
        + " FROM courses WHERE id = #{oldId}")
    int cloneCourseMain(@Param("newId") String newId, @Param("tenantId") String tenantId,
                        @Param("code") String code, @Param("newName") String newName,
                        @Param("oldId") String oldId, @Param("creatorId") String creatorId);

    /** 克隆课程知识点绑定（INSERT...SELECT）。 */
    @Insert("INSERT INTO course_knowledge_bindings (id, tenant_id, course_id, knowledge_point_id, bind_type, source_id)"
        + " SELECT gen_random_uuid(), #{tenantId}, #{newId}, knowledge_point_id, bind_type, source_id"
        + " FROM course_knowledge_bindings WHERE course_id = #{oldId}")
    int cloneKnowledgeBindings(@Param("newId") String newId, @Param("oldId") String oldId,
                               @Param("tenantId") String tenantId);

    /** 克隆课程资源绑定（INSERT...SELECT）。 */
    @Insert("INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)"
        + " SELECT gen_random_uuid(), #{tenantId}, #{newId}, resource_id"
        + " FROM course_resource_bindings WHERE course_id = #{oldId}")
    int cloneResourceBindings(@Param("newId") String newId, @Param("oldId") String oldId,
                              @Param("tenantId") String tenantId);

    /** 克隆后按节点数回填 node_count。 */
    @Update("UPDATE courses SET node_count = (SELECT COUNT(*) FROM system_course_nodes WHERE course_id = #{id}),"
        + " updated_at = NOW() WHERE id = #{id}")
    int updateNodeCount(@Param("id") String id);

    @Select("SELECT id, parent_id::text AS parent_id, name, code, sort_order, ref_type, source_id::text AS source_id,"
        + " source_name, teaching_goals, detailed_description, description_pdf, background, estimated_hours,"
        + " duration, difficulty, knowledge_point_ids::text[] AS knowledge_point_ids,"
        + " resource_ids::text[] AS resource_ids, ability_point_ids::text[] AS ability_point_ids,"
        + " eval_data::text AS eval_data, status FROM system_course_nodes WHERE course_id = #{courseId}"
        + " ORDER BY sort_order ASC, id ASC")
    List<NodeSourceRow> selectSourceNodes(@Param("courseId") String courseId);

    /** 插入克隆节点。 */
    @Insert("INSERT INTO system_course_nodes (id, tenant_id, course_id, parent_id, name, code, sort_order, ref_type,"
        + " source_id, source_name, teaching_goals, detailed_description, description_pdf, background, estimated_hours,"
        + " duration, difficulty, knowledge_point_ids, resource_ids, ability_point_ids, eval_data, status)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{courseId}::uuid, #{parentId}::uuid, #{name}, #{code}, #{sortOrder},"
        + " #{refType}, #{sourceId}::uuid, #{sourceName}, #{teachingGoals}, #{detailedDescription}, #{descriptionPdf},"
        + " #{background}, #{estimatedHours}, #{duration}, #{difficulty},"
        + " CAST(#{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " CAST(#{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " CAST(#{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " CAST(#{evalData} AS jsonb), #{status})")
    int insertCloneNode(@Param("id") String id, @Param("tenantId") String tenantId, @Param("courseId") String courseId,
                        @Param("parentId") String parentId, @Param("name") String name, @Param("code") String code,
                        @Param("sortOrder") Integer sortOrder, @Param("refType") String refType,
                        @Param("sourceId") String sourceId, @Param("sourceName") String sourceName,
                        @Param("teachingGoals") String teachingGoals, @Param("detailedDescription") String detailedDescription,
                        @Param("descriptionPdf") String descriptionPdf, @Param("background") String background,
                        @Param("estimatedHours") BigDecimal estimatedHours, @Param("duration") Integer duration,
                        @Param("difficulty") Integer difficulty, @Param("knowledgePointIds") List<String> knowledgePointIds,
                        @Param("resourceIds") List<String> resourceIds, @Param("abilityPointIds") List<String> abilityPointIds,
                        @Param("evalData") String evalData, @Param("status") String status);

    /** 克隆节点知识点绑定。 */
    @Insert("INSERT INTO node_knowledge_point_bindings (id, node_id, knowledge_point_id)"
        + " SELECT gen_random_uuid(), #{newNodeId}, knowledge_point_id FROM node_knowledge_point_bindings WHERE node_id = #{oldNodeId}")
    int cloneNodeKnowledgeBindings(@Param("oldNodeId") String oldNodeId, @Param("newNodeId") String newNodeId);

    /** 克隆节点资源绑定。 */
    @Insert("INSERT INTO node_resource_bindings (id, node_id, resource_id)"
        + " SELECT gen_random_uuid(), #{newNodeId}, resource_id FROM node_resource_bindings WHERE node_id = #{oldNodeId}")
    int cloneNodeResourceBindings(@Param("oldNodeId") String oldNodeId, @Param("newNodeId") String newNodeId);

    @Select("<script>SELECT id, node_id::text AS node_id, title, type, time_limit FROM node_quizzes"
        + " WHERE node_id IN <foreach collection='nodeIds' item='n' open='(' separator=',' close=')'>#{n}::uuid</foreach></script>")
    List<QuizSourceRow> selectSourceQuizzes(@Param("nodeIds") List<String> nodeIds);

    @Insert("INSERT INTO node_quizzes (id, tenant_id, node_id, title, type, time_limit)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{nodeId}::uuid, #{title}, #{type}, #{timeLimit})")
    int insertCloneQuiz(@Param("id") String id, @Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                        @Param("title") String title, @Param("type") String type, @Param("timeLimit") Integer timeLimit);

    @Select("<script>SELECT quiz_id::text AS quiz_id, type, question, options::text AS options, answer, score, sort_order"
        + " FROM node_quiz_questions WHERE quiz_id IN <foreach collection='quizIds' item='q' open='(' separator=',' close=')'>#{q}::uuid</foreach>"
        + " ORDER BY sort_order ASC</script>")
    List<QuestionSourceRow> selectSourceQuizQuestions(@Param("quizIds") List<String> quizIds);

    @Insert("INSERT INTO node_quiz_questions (id, tenant_id, quiz_id, type, question, options, answer, score, sort_order)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{quizId}::uuid, #{type}, #{question}, CAST(#{options} AS jsonb),"
        + " #{answer}, #{score}, #{sortOrder})")
    int insertCloneQuizQuestion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("quizId") String quizId,
                                @Param("type") String type, @Param("question") String question,
                                @Param("options") String options, @Param("answer") String answer,
                                @Param("score") BigDecimal score, @Param("sortOrder") Integer sortOrder);

    @Select("<script>SELECT node_id::text AS node_id, module_key, mode, data::text AS data FROM hybrid_node_modules"
        + " WHERE node_id IN <foreach collection='nodeIds' item='n' open='(' separator=',' close=')'>#{n}::uuid</foreach></script>")
    List<HybridSourceRow> selectSourceHybridModules(@Param("nodeIds") List<String> nodeIds);

    @Insert("INSERT INTO hybrid_node_modules (id, tenant_id, node_id, module_key, mode, data)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{nodeId}::uuid, #{moduleKey}, #{mode}, CAST(#{data} AS jsonb))")
    int insertCloneHybridModule(@Param("id") String id, @Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                                @Param("moduleKey") String moduleKey, @Param("mode") String mode, @Param("data") String data);
}
