package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.domain.scene.SceneScenarioTask;

import java.math.BigDecimal;
import java.util.List;

/**
 * 场景任务 Mapper（scenario_tasks 表，Go→Java 迁移）。
 *
 * <p>读取走 MyBatis-Plus 内置方法；写入走自定义 SQL（eval_data jsonb 需显式 CAST，
 * uuid[] 数组列同理）。eval_data 以 String 承载 JSON 原文。</p>
 *
 * @author zhiyu
 */
public interface SceneScenarioTaskMapper extends BaseMapperPlus<SceneScenarioTask, SceneScenarioTask> {

    /**
     * 创建任务（对齐 Go ScenarioTaskStore.Create）。
     */
    @Insert("INSERT INTO scenario_tasks (id, scenario_id, name, code, sort_order, description, detailed_description,"
        + " description_pdf, estimated_hours, task_type, difficulty, background,"
        + " dependency_ids, is_referenced, source_scenario_id,"
        + " knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id)"
        + " VALUES (#{id}, #{scenarioId}, #{name}, #{code}, #{sortOrder}, #{description}, #{detailedDescription},"
        + " #{descriptionPdf}, #{estimatedHours}, #{taskType}, #{difficulty}, #{background},"
        + " CAST(#{dependencyIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " #{isReferenced}, #{sourceScenarioId},"
        + " CAST(#{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " CAST(#{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " CAST(#{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " CAST(#{evalData} AS jsonb), #{tenantId})")
    int insertTask(@Param("id") String id, @Param("scenarioId") String scenarioId, @Param("name") String name,
                   @Param("code") String code, @Param("sortOrder") Integer sortOrder,
                   @Param("description") String description, @Param("detailedDescription") String detailedDescription,
                   @Param("descriptionPdf") String descriptionPdf, @Param("estimatedHours") BigDecimal estimatedHours,
                   @Param("taskType") String taskType, @Param("difficulty") Integer difficulty,
                   @Param("background") String background, @Param("dependencyIds") List<String> dependencyIds,
                   @Param("isReferenced") Boolean isReferenced, @Param("sourceScenarioId") String sourceScenarioId,
                   @Param("knowledgePointIds") List<String> knowledgePointIds,
                   @Param("abilityPointIds") List<String> abilityPointIds, @Param("resourceIds") List<String> resourceIds,
                   @Param("evalData") String evalData, @Param("tenantId") String tenantId);

    /**
     * 更新任务（限定租户；影响 0 行视为不存在，对齐 Go ScenarioTaskStore.Update）。
     */
    @Update("UPDATE scenario_tasks SET scenario_id = #{scenarioId}, name = #{name}, code = #{code}, sort_order = #{sortOrder},"
        + " description = #{description}, detailed_description = #{detailedDescription}, description_pdf = #{descriptionPdf},"
        + " estimated_hours = #{estimatedHours}, task_type = #{taskType}, difficulty = #{difficulty}, background = #{background},"
        + " dependency_ids = CAST(#{dependencyIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " is_referenced = #{isReferenced}, source_scenario_id = #{sourceScenarioId},"
        + " knowledge_point_ids = CAST(#{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " ability_point_ids = CAST(#{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " resource_ids = CAST(#{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " eval_data = CAST(#{evalData} AS jsonb)"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateTask(@Param("id") String id, @Param("tenantId") String tenantId, @Param("scenarioId") String scenarioId,
                   @Param("name") String name, @Param("code") String code, @Param("sortOrder") Integer sortOrder,
                   @Param("description") String description, @Param("detailedDescription") String detailedDescription,
                   @Param("descriptionPdf") String descriptionPdf, @Param("estimatedHours") BigDecimal estimatedHours,
                   @Param("taskType") String taskType, @Param("difficulty") Integer difficulty,
                   @Param("background") String background, @Param("dependencyIds") List<String> dependencyIds,
                   @Param("isReferenced") Boolean isReferenced, @Param("sourceScenarioId") String sourceScenarioId,
                   @Param("knowledgePointIds") List<String> knowledgePointIds,
                   @Param("abilityPointIds") List<String> abilityPointIds, @Param("resourceIds") List<String> resourceIds,
                   @Param("evalData") String evalData);

    /**
     * 删除任务（限定租户）。
     */
    @Delete("DELETE FROM scenario_tasks WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteTask(@Param("id") String id, @Param("tenantId") String tenantId);

    /**
     * 重排任务排序（事务内逐条更新，对齐 Go ScenarioTaskStore.Reorder）。
     */
    @Update("UPDATE scenario_tasks SET sort_order = #{sortOrder} WHERE id = #{taskId} AND scenario_id = #{scenarioId}")
    int reorderTask(@Param("taskId") String taskId, @Param("scenarioId") String scenarioId, @Param("sortOrder") int sortOrder);

    /**
     * 查询任务所属场景 ID（归属校验用）。
     */
    @Select("SELECT scenario_id FROM scenario_tasks WHERE id = #{id}")
    String selectScenarioId(@Param("id") String id);

    /**
     * 查询任务所属租户（归属校验用；可为 null）。
     */
    @Select("SELECT tenant_id FROM scenario_tasks WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    /**
     * 任务测评成绩存在性（删除保护）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM scene_evaluation_results WHERE task_id = #{id})")
    boolean existsEvaluationResults(@Param("id") String id);

    /** 查询任务名称。 */
    @Select("SELECT name FROM scenario_tasks WHERE id = #{id}")
    String selectName(@Param("id") String id);

    /** 查询任务所属场景名称（考试安排自动命名前缀用；对齐 Go TaskScenarioName）。 */
    @Select("SELECT COALESCE(sc.name, '') FROM scenario_tasks st"
        + " JOIN scenarios sc ON sc.id = st.scenario_id WHERE st.id = #{id}")
    String selectScenarioName(@Param("id") String id);

    /**
     * 清理任务关联的考试安排（target_type='task'，无成绩的安排删除并返回其 exam_id；
     * 对齐 Go CleanupTaskExamUsages 第一步，两条语句不可合并为 CTE 快照语义问题）。
     */
    @Select("WITH del AS ("
        + " DELETE FROM exam_usages"
        + " WHERE target_type = 'task' AND #{taskId}::uuid = ANY(target_ids)"
        + " AND NOT EXISTS (SELECT 1 FROM exam_results er WHERE er.exam_usage_id = exam_usages.id)"
        + " RETURNING exam_id)"
        + " SELECT exam_id FROM del")
    List<String> cleanupTaskExamUsages(@Param("taskId") String taskId);

    /**
     * 删除不再被任何安排引用的独占临时考试（对齐 Go CleanupTaskExamUsages 第二步）。
     */
    @Delete("<script>DELETE FROM exams e"
        + " WHERE e.is_temp = TRUE"
        + " AND e.id = ANY(CAST(#{examIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]))"
        + " AND NOT EXISTS (SELECT 1 FROM exam_usages eu WHERE eu.exam_id = e.id)</script>")
    int deleteOrphanTempExams(@Param("examIds") List<String> examIds);

    /**
     * 批量查询知识点名称（PopulateKnowledgePointNames）。
     */
    @Select("<script>SELECT id, name FROM knowledge_points WHERE id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}::uuid</foreach></script>")
    List<IdNameRow> selectKnowledgePointNames(@Param("ids") List<String> ids);

    /**
     * 批量查询能力点名称（PopulateAbilityPointNames）。
     */
    @Select("<script>SELECT id, name FROM ability_points WHERE id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}::uuid</foreach></script>")
    List<IdNameRow> selectAbilityPointNames(@Param("ids") List<String> ids);

    /**
     * 批量查询任务已启用的测评方法摘要（PopulateEvalData：evaluationMethods + methodWeights）。
     */
    @Select("<script>SELECT task_id, method_key, weight FROM task_evaluation_methods"
        + " WHERE task_id IN"
        + " <foreach collection=\"taskIds\" item=\"tid\" open=\"(\" separator=\",\" close=\")\">#{tid}::uuid</foreach>"
        + " AND is_enabled = true ORDER BY method_key</script>")
    List<MethodSummaryRow> selectEnabledMethods(@Param("taskIds") List<String> taskIds);

    /** 知识点/能力点名称行（id → name）。 */
    class IdNameRow {
        private String id;
        private String name;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }

    /** 测评方法摘要行。 */
    class MethodSummaryRow {
        private String taskId;
        private String methodKey;
        private BigDecimal weight;

        public String getTaskId() {
            return taskId;
        }

        public void setTaskId(String taskId) {
            this.taskId = taskId;
        }

        public String getMethodKey() {
            return methodKey;
        }

        public void setMethodKey(String methodKey) {
            this.methodKey = methodKey;
        }

        public BigDecimal getWeight() {
            return weight;
        }

        public void setWeight(BigDecimal weight) {
            this.weight = weight;
        }
    }
}
