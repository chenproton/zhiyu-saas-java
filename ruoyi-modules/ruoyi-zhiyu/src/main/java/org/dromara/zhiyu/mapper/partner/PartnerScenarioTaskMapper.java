package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneScenarioTask;

import java.math.BigDecimal;
import java.util.List;

/**
 * 企业共建场景任务 Mapper（scenario_tasks 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface PartnerScenarioTaskMapper extends BaseMapperPlus<SceneScenarioTask, SceneScenarioTask> {

    @Insert("INSERT INTO scenario_tasks (id, scenario_id, name, code, sort_order, description, detailed_description,"
        + " description_pdf, estimated_hours, task_type, difficulty, background, dependency_ids, is_referenced,"
        + " source_scenario_id, knowledge_point_ids, ability_point_ids, resource_ids, eval_data, tenant_id)"
        + " VALUES (#{id}, #{scenarioId}, #{name}, #{code}, #{sortOrder}, #{description}, #{detailedDescription},"
        + " #{descriptionPdf}, #{estimatedHours}, #{taskType}, #{difficulty}, #{background},"
        + " #{dependencyIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{isReferenced}, #{sourceScenarioId},"
        + " #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " CAST(#{evalData} AS JSON), #{tenantId})")
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

    @Update("UPDATE scenario_tasks SET scenario_id = #{scenarioId}, name = #{name}, code = #{code}, sort_order = #{sortOrder},"
        + " description = #{description}, detailed_description = #{detailedDescription}, description_pdf = #{descriptionPdf},"
        + " estimated_hours = #{estimatedHours}, task_type = #{taskType}, difficulty = #{difficulty}, background = #{background},"
        + " dependency_ids = #{dependencyIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " is_referenced = #{isReferenced}, source_scenario_id = #{sourceScenarioId},"
        + " knowledge_point_ids = #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " ability_point_ids = #{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " resource_ids = #{resourceIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " eval_data = CAST(#{evalData} AS JSON)"
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

    @Delete("DELETE FROM scenario_tasks WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteTask(@Param("id") String id, @Param("tenantId") String tenantId);

    @Update("UPDATE scenario_tasks SET sort_order = #{sortOrder} WHERE id = #{taskId} AND scenario_id = #{scenarioId}")
    int reorderTask(@Param("taskId") String taskId, @Param("scenarioId") String scenarioId, @Param("sortOrder") int sortOrder);

    @Select("SELECT scenario_id FROM scenario_tasks WHERE id = #{id}")
    String selectScenarioId(@Param("id") String id);

    @Select("SELECT tenant_id FROM scenario_tasks WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    @Select("SELECT name FROM scenario_tasks WHERE id = #{id}")
    String selectName(@Param("id") String id);

    @Select("SELECT EXISTS(SELECT 1 FROM scene_evaluation_results WHERE task_id = #{id})")
    boolean existsEvaluationResults(@Param("id") String id);

    @Select("<script>SELECT id, name FROM knowledge_points WHERE id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}</foreach></script>")
    List<IdNameRow> selectKnowledgePointNames(@Param("ids") List<String> ids);

    @Select("<script>SELECT id, name FROM ability_points WHERE id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}</foreach></script>")
    List<IdNameRow> selectAbilityPointNames(@Param("ids") List<String> ids);

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
}
