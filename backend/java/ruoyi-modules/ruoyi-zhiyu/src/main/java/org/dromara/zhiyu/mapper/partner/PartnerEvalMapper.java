package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneEvalMethod;

import java.math.BigDecimal;
import java.util.List;

/**
 * 任务测评方式 Mapper（task_evaluation_methods 及子表，Go→Java 迁移，企业共建域）。
 *
 * @author zhiyu
 */
public interface PartnerEvalMapper extends BaseMapperPlus<SceneEvalMethod, SceneEvalMethod> {

    @Select("SELECT pg_advisory_xact_lock(hashtext(#{key}))")
    void lockTaskEval(@Param("key") String key);

    @Select("SELECT COALESCE(MAX(version), 0) FROM task_evaluation_methods WHERE task_id = #{taskId} AND tenant_id = #{tenantId}")
    Integer selectMaxVersion(@Param("taskId") String taskId, @Param("tenantId") String tenantId);

    @Select("SELECT name FROM scenario_tasks WHERE id = #{taskId}")
    String selectTaskName(@Param("taskId") String taskId);

    @Select("INSERT INTO task_evaluation_methods (tenant_id, task_id, method_key, weight, eval_object, score_type,"
        + " eval_subjects, standard_name, standard_mode, resource_config, version, is_enabled)"
        + " VALUES (#{tenantId}, #{taskId}, #{methodKey}, #{weight}, #{evalObject}, #{scoreType},"
        + " CAST(#{evalSubjects} AS JSON), #{standardName}, #{standardMode}, CAST(#{resourceConfig} AS JSON),"
        + " #{version}, #{isEnabled})"
        + " ON DUPLICATE KEY UPDATE weight = VALUES(weight), eval_object = VALUES(eval_object),"
        + " score_type = VALUES(score_type), eval_subjects = VALUES(eval_subjects),"
        + " standard_name = VALUES(standard_name), standard_mode = VALUES(standard_mode),"
        + " resource_config = VALUES(resource_config), version = VALUES(version), is_enabled = VALUES(is_enabled),"
        + " updated_at = now() RETURNING id")
    String upsertMethodReturnId(@Param("tenantId") String tenantId, @Param("taskId") String taskId,
                                @Param("methodKey") String methodKey, @Param("weight") BigDecimal weight,
                                @Param("evalObject") String evalObject, @Param("scoreType") String scoreType,
                                @Param("evalSubjects") String evalSubjects, @Param("standardName") String standardName,
                                @Param("standardMode") String standardMode, @Param("resourceConfig") String resourceConfig,
                                @Param("version") Integer version, @Param("isEnabled") Boolean isEnabled);

    @Delete("DELETE FROM task_eval_points WHERE config_id = #{configId}")
    int deleteEvalPoints(@Param("configId") String configId);

    @Delete("DELETE FROM task_eval_score_rules WHERE config_id = #{configId}")
    int deleteScoreRules(@Param("configId") String configId);

    @Delete("DELETE FROM task_review_steps WHERE config_id = #{configId}")
    int deleteReviewSteps(@Param("configId") String configId);

    @Insert("INSERT INTO task_eval_points (tenant_id, config_id, name, description, sub_type, types, weight,"
        + " scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order)"
        + " VALUES (#{tenantId}, #{configId}, #{name}, #{description}, #{subType},"
        + " #{types, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler}, #{weight},"
        + " #{scoringMethod}, CAST(#{gradeMapping} AS JSON),"
        + " #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{abilityPointIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler},"
        + " #{sortOrder})")
    int insertEvalPoint(@Param("tenantId") String tenantId, @Param("configId") String configId,
                        @Param("name") String name, @Param("description") String description,
                        @Param("subType") String subType, @Param("types") List<String> types,
                        @Param("weight") BigDecimal weight, @Param("scoringMethod") String scoringMethod,
                        @Param("gradeMapping") String gradeMapping,
                        @Param("knowledgePointIds") List<String> knowledgePointIds,
                        @Param("abilityPointIds") List<String> abilityPointIds, @Param("sortOrder") Integer sortOrder);

    @Insert("INSERT INTO task_eval_score_rules (tenant_id, config_id, name, description, rule, weight, sort_order)"
        + " VALUES (#{tenantId}, #{configId}, #{name}, #{description}, #{rule}, #{weight}, #{sortOrder})")
    int insertScoreRule(@Param("tenantId") String tenantId, @Param("configId") String configId,
                        @Param("name") String name, @Param("description") String description,
                        @Param("rule") String rule, @Param("weight") BigDecimal weight,
                        @Param("sortOrder") Integer sortOrder);

    @Insert("INSERT INTO task_review_steps (tenant_id, config_id, label, description, enabled, subject_type, weight,"
        + " sort_order, assigned_user_ids)"
        + " VALUES (#{tenantId}, #{configId}, #{label}, #{description}, #{enabled}, #{subjectType}, #{weight},"
        + " #{sortOrder}, #{assignedUserIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler})")
    int insertReviewStep(@Param("tenantId") String tenantId, @Param("configId") String configId,
                         @Param("label") String label, @Param("description") String description,
                         @Param("enabled") Boolean enabled, @Param("subjectType") String subjectType,
                         @Param("weight") BigDecimal weight, @Param("sortOrder") Integer sortOrder,
                         @Param("assignedUserIds") List<String> assignedUserIds);

    @Select("SELECT id, config_id AS configId, name, description, sub_type AS subType,"
        + " array_to_json(types) AS types, weight, scoring_method AS scoringMethod,"
        + " grade_mapping AS gradeMapping, array_to_json(knowledge_point_ids) AS knowledgePointIds,"
        + " array_to_json(ability_point_ids) AS abilityPointIds, sort_order AS sortOrder"
        + " FROM task_eval_points WHERE config_id = #{configId} ORDER BY sort_order")
    List<EvalPointRow> selectEvalPoints(@Param("configId") String configId);

    @Select("SELECT id, config_id AS configId, name, description, rule, weight, sort_order AS sortOrder"
        + " FROM task_eval_score_rules WHERE config_id = #{configId} ORDER BY sort_order")
    List<ScoreRuleRow> selectScoreRules(@Param("configId") String configId);

    @Select("SELECT id, config_id AS configId, label, description, enabled, subject_type AS subjectType,"
        + " array_to_json(assigned_user_ids) AS assignedUserIds, weight, sort_order AS sortOrder"
        + " FROM task_review_steps WHERE config_id = #{configId} ORDER BY sort_order")
    List<ReviewStepRow> selectReviewSteps(@Param("configId") String configId);

    class EvalPointRow {
        private String id;
        private String configId;
        private String name;
        private String description;
        private String subType;
        private String types;
        private BigDecimal weight;
        private String scoringMethod;
        private String gradeMapping;
        private String knowledgePointIds;
        private String abilityPointIds;
        private Integer sortOrder;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getConfigId() {
            return configId;
        }

        public void setConfigId(String configId) {
            this.configId = configId;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getSubType() {
            return subType;
        }

        public void setSubType(String subType) {
            this.subType = subType;
        }

        public String getTypes() {
            return types;
        }

        public void setTypes(String types) {
            this.types = types;
        }

        public BigDecimal getWeight() {
            return weight;
        }

        public void setWeight(BigDecimal weight) {
            this.weight = weight;
        }

        public String getScoringMethod() {
            return scoringMethod;
        }

        public void setScoringMethod(String scoringMethod) {
            this.scoringMethod = scoringMethod;
        }

        public String getGradeMapping() {
            return gradeMapping;
        }

        public void setGradeMapping(String gradeMapping) {
            this.gradeMapping = gradeMapping;
        }

        public String getKnowledgePointIds() {
            return knowledgePointIds;
        }

        public void setKnowledgePointIds(String knowledgePointIds) {
            this.knowledgePointIds = knowledgePointIds;
        }

        public String getAbilityPointIds() {
            return abilityPointIds;
        }

        public void setAbilityPointIds(String abilityPointIds) {
            this.abilityPointIds = abilityPointIds;
        }

        public Integer getSortOrder() {
            return sortOrder;
        }

        public void setSortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
        }
    }

    class ScoreRuleRow {
        private String id;
        private String configId;
        private String name;
        private String description;
        private String rule;
        private BigDecimal weight;
        private Integer sortOrder;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getConfigId() {
            return configId;
        }

        public void setConfigId(String configId) {
            this.configId = configId;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getRule() {
            return rule;
        }

        public void setRule(String rule) {
            this.rule = rule;
        }

        public BigDecimal getWeight() {
            return weight;
        }

        public void setWeight(BigDecimal weight) {
            this.weight = weight;
        }

        public Integer getSortOrder() {
            return sortOrder;
        }

        public void setSortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
        }
    }

    class ReviewStepRow {
        private String id;
        private String configId;
        private String label;
        private String description;
        private Boolean enabled;
        private String subjectType;
        private String assignedUserIds;
        private BigDecimal weight;
        private Integer sortOrder;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getConfigId() {
            return configId;
        }

        public void setConfigId(String configId) {
            this.configId = configId;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public Boolean getEnabled() {
            return enabled;
        }

        public void setEnabled(Boolean enabled) {
            this.enabled = enabled;
        }

        public String getSubjectType() {
            return subjectType;
        }

        public void setSubjectType(String subjectType) {
            this.subjectType = subjectType;
        }

        public String getAssignedUserIds() {
            return assignedUserIds;
        }

        public void setAssignedUserIds(String assignedUserIds) {
            this.assignedUserIds = assignedUserIds;
        }

        public BigDecimal getWeight() {
            return weight;
        }

        public void setWeight(BigDecimal weight) {
            this.weight = weight;
        }

        public Integer getSortOrder() {
            return sortOrder;
        }

        public void setSortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
        }
    }
}
