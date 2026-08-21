package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneEvalMethod;
import org.dromara.zhiyu.domain.scene.SceneWeightConfig;

import java.math.BigDecimal;
import java.util.List;

/**
 * 场景克隆 Mapper（Go→Java 迁移，对齐 store/scenario_clone.go）。
 *
 * <p>克隆 = 事务内多表复制：读取源行（JSON/数组列以 JSON 文本返回，Service 解析），
 * 再以新 UUID 插入目标行。UUID 全部由 Service 用 UUID.randomUUID() 生成。</p>
 *
 * @author zhiyu
 */
public interface SceneCloneMapper extends BaseMapperPlus<SceneWeightConfig, SceneWeightConfig> {

    // ---------- 源数据读取 ----------

    /** 源场景字段（FetchSource）。 */
    @Select("SELECT name, code, cover_image, career_position_id,"
        + " COALESCE(industry_ids, JSON_ARRAY()) AS industry_ids,"
        + " COALESCE(profession_ids, JSON_ARRAY()) AS profession_ids,"
        + " batch_id, difficulty, version, background, delivery_goal,"
        + " COALESCE(co_builder_ids, JSON_ARRAY()) AS co_builder_ids, tenant_id"
        + " FROM scenarios WHERE id = #{id}")
    SourceScenarioRow fetchSource(@Param("id") String id);

    /** 源场景任务（含 JSON/数组列 JSON 文本）。 */
    @Select("SELECT id, name, code, sort_order, description, detailed_description, description_pdf,"
        + " estimated_hours, task_type, difficulty, background,"
        + " COALESCE(dependency_ids, JSON_ARRAY()) AS dependency_ids,"
        + " COALESCE(knowledge_point_ids, JSON_ARRAY()) AS knowledge_point_ids,"
        + " COALESCE(ability_point_ids, JSON_ARRAY()) AS ability_point_ids,"
        + " COALESCE(resource_ids, JSON_ARRAY()) AS resource_ids,"
        + " COALESCE(eval_data, JSON_ARRAY()) AS eval_data"
        + " FROM scenario_tasks WHERE scenario_id = #{scenarioId} ORDER BY sort_order")
    List<TaskSourceRow> fetchTasks(@Param("scenarioId") String scenarioId);

    /** 源交付物。 */
    @Select("SELECT type, name, description, COALESCE(evaluation_points, JSON_ARRAY()) AS evaluation_points, sort_order"
        + " FROM task_deliverables WHERE task_id = #{taskId} ORDER BY sort_order")
    List<DeliverableRow> fetchDeliverables(@Param("taskId") String taskId);

    /** 源测评方法（含 JSON 列文本；扫描失败按 Go 语义整体失败）。 */
    @Select("SELECT id, method_key, weight, eval_object, score_type,"
        + " COALESCE(eval_subjects, '[]') AS eval_subjects, standard_name, standard_mode,"
        + " COALESCE(resource_config, JSON_ARRAY()) AS resource_config, version, is_enabled"
        + " FROM task_evaluation_methods WHERE task_id = #{taskId} AND tenant_id = #{tenantId}")
    List<MethodSourceRow> fetchMethods(@Param("taskId") String taskId, @Param("tenantId") String tenantId);

    /** 源评估点（数组/JSON 列 JSON 文本）。 */
    @Select("SELECT name, description, sub_type, COALESCE(types, JSON_ARRAY()) AS types,"
        + " weight, scoring_method, COALESCE(grade_mapping, '[]') AS grade_mapping,"
        + " COALESCE(knowledge_point_ids, JSON_ARRAY()) AS knowledge_point_ids,"
        + " COALESCE(ability_point_ids, JSON_ARRAY()) AS ability_point_ids, sort_order"
        + " FROM task_eval_points WHERE config_id = #{configId}")
    List<EvalPointSourceRow> fetchEvalPoints(@Param("configId") String configId);

    /** 源评分规则。 */
    @Select("SELECT name, description, rule, weight, sort_order"
        + " FROM task_eval_score_rules WHERE config_id = #{configId}")
    List<ScoreRuleSourceRow> fetchScoreRules(@Param("configId") String configId);

    /** 源评审步骤（assigned_user_ids 不复制，对齐 Go）。 */
    @Select("SELECT label, description, enabled, subject_type, weight, sort_order"
        + " FROM task_review_steps WHERE config_id = #{configId}")
    List<ReviewStepSourceRow> fetchReviewSteps(@Param("configId") String configId);

    /** 源资源绑定目标 ID 列表。 */
    @Select("SELECT resource_id FROM task_resource_bindings WHERE task_id = #{taskId}")
    List<String> fetchResourceBindingTargets(@Param("taskId") String taskId);

    /** 源知识点绑定目标 ID 列表。 */
    @Select("SELECT knowledge_point_id FROM task_knowledge_bindings WHERE task_id = #{taskId}")
    List<String> fetchKnowledgeBindingTargets(@Param("taskId") String taskId);

    /** 源能力点绑定目标 ID 列表。 */
    @Select("SELECT ability_point_id FROM task_ability_bindings WHERE task_id = #{taskId}")
    List<String> fetchAbilityBindingTargets(@Param("taskId") String taskId);

    /** 源场景权重。 */
    @Select("SELECT task_id, weight FROM scenario_weight_configs WHERE scenario_id = #{scenarioId}")
    List<WeightSourceRow> fetchWeights(@Param("scenarioId") String scenarioId);

    /** 源等级映射。 */
    @Select("SELECT task_id, level, min_score, max_score, description, color"
        + " FROM scenario_grade_mappings WHERE scenario_id = #{scenarioId}")
    List<GradeMappingSourceRow> fetchGradeMappings(@Param("scenarioId") String scenarioId);

    // ---------- 目标写入 ----------

    /** 插入克隆交付物。 */
    @Insert("INSERT INTO task_deliverables (id, task_id, type, name, description, evaluation_points, sort_order, tenant_id)"
        + " VALUES (#{id}, #{taskId}, #{type}, #{name}, #{description}, CAST(#{evaluationPoints} AS JSON), #{sortOrder}, #{tenantId})")
    int insertDeliverable(@Param("id") String id, @Param("taskId") String taskId, @Param("type") String type,
                          @Param("name") String name, @Param("description") String description,
                          @Param("evaluationPoints") String evaluationPoints, @Param("sortOrder") Integer sortOrder,
                          @Param("tenantId") String tenantId);

    /** 插入克隆测评方法。 */
    @Insert("INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, eval_object, score_type,"
        + " eval_subjects, standard_name, standard_mode, resource_config, version, is_enabled)"
        + " VALUES (#{id}, #{tenantId}, #{taskId}, #{methodKey}, #{weight}, #{evalObject}, #{scoreType},"
        + " CAST(#{evalSubjects} AS JSON), #{standardName}, #{standardMode}, CAST(#{resourceConfig} AS JSON),"
        + " #{version}, #{isEnabled})")
    int insertMethod(@Param("id") String id, @Param("tenantId") String tenantId, @Param("taskId") String taskId,
                     @Param("methodKey") String methodKey, @Param("weight") BigDecimal weight,
                     @Param("evalObject") String evalObject, @Param("scoreType") String scoreType,
                     @Param("evalSubjects") String evalSubjects, @Param("standardName") String standardName,
                     @Param("standardMode") String standardMode, @Param("resourceConfig") String resourceConfig,
                     @Param("version") Integer version, @Param("isEnabled") Boolean isEnabled);

    /** 插入克隆评估点。 */
    @Insert("INSERT INTO task_eval_points (id, tenant_id, config_id, name, description, sub_type, types, weight,"
        + " scoring_method, grade_mapping, knowledge_point_ids, ability_point_ids, sort_order)"
        + " VALUES (#{id}, #{tenantId}, #{configId}, #{name}, #{description}, #{subType},"
        + " #{types}, #{weight}, #{scoringMethod}, CAST(#{gradeMapping} AS JSON),"
        + " #{knowledgePointIds}, #{abilityPointIds}, #{sortOrder})")
    int insertEvalPoint(@Param("id") String id, @Param("tenantId") String tenantId, @Param("configId") String configId,
                        @Param("name") String name, @Param("description") String description,
                        @Param("subType") String subType, @Param("types") String types,
                        @Param("weight") BigDecimal weight, @Param("scoringMethod") String scoringMethod,
                        @Param("gradeMapping") String gradeMapping, @Param("knowledgePointIds") String knowledgePointIds,
                        @Param("abilityPointIds") String abilityPointIds, @Param("sortOrder") Integer sortOrder);

    /** 插入克隆评分规则。 */
    @Insert("INSERT INTO task_eval_score_rules (id, tenant_id, config_id, name, description, rule, weight, sort_order)"
        + " VALUES (#{id}, #{tenantId}, #{configId}, #{name}, #{description}, #{rule}, #{weight}, #{sortOrder})")
    int insertScoreRule(@Param("id") String id, @Param("tenantId") String tenantId, @Param("configId") String configId,
                        @Param("name") String name, @Param("description") String description,
                        @Param("rule") String rule, @Param("weight") BigDecimal weight,
                        @Param("sortOrder") Integer sortOrder);

    /** 插入克隆评审步骤。 */
    @Insert("INSERT INTO task_review_steps (id, tenant_id, config_id, label, description, enabled, subject_type, weight, sort_order)"
        + " VALUES (#{id}, #{tenantId}, #{configId}, #{label}, #{description}, #{enabled}, #{subjectType}, #{weight}, #{sortOrder})")
    int insertReviewStep(@Param("id") String id, @Param("tenantId") String tenantId, @Param("configId") String configId,
                         @Param("label") String label, @Param("description") String description,
                         @Param("enabled") Boolean enabled, @Param("subjectType") String subjectType,
                         @Param("weight") BigDecimal weight, @Param("sortOrder") Integer sortOrder);

    /** 插入克隆资源绑定。 */
    @Insert("INSERT INTO task_resource_bindings (id, task_id, resource_id, tenant_id)"
        + " VALUES (#{id}, #{taskId}, #{targetId}, #{tenantId})")
    int insertResourceBinding(@Param("id") String id, @Param("taskId") String taskId,
                              @Param("targetId") String targetId, @Param("tenantId") String tenantId);

    /** 插入克隆知识点绑定。 */
    @Insert("INSERT INTO task_knowledge_bindings (id, task_id, knowledge_point_id, tenant_id)"
        + " VALUES (#{id}, #{taskId}, #{targetId}, #{tenantId})")
    int insertKnowledgeBinding(@Param("id") String id, @Param("taskId") String taskId,
                               @Param("targetId") String targetId, @Param("tenantId") String tenantId);

    /** 插入克隆能力点绑定。 */
    @Insert("INSERT INTO task_ability_bindings (id, task_id, ability_point_id, tenant_id)"
        + " VALUES (#{id}, #{taskId}, #{targetId}, #{tenantId})")
    int insertAbilityBinding(@Param("id") String id, @Param("taskId") String taskId,
                             @Param("targetId") String targetId, @Param("tenantId") String tenantId);

    /** 插入克隆权重。 */
    @Insert("INSERT INTO scenario_weight_configs (id, scenario_id, task_id, weight, tenant_id)"
        + " VALUES (#{id}, #{scenarioId}, #{taskId}, #{weight}, #{tenantId})")
    int insertWeight(@Param("id") String id, @Param("scenarioId") String scenarioId,
                     @Param("taskId") String taskId, @Param("weight") BigDecimal weight,
                     @Param("tenantId") String tenantId);

    /** 插入克隆等级映射。 */
    @Insert("INSERT INTO scenario_grade_mappings (id, scenario_id, task_id, level, min_score, max_score, description, color, tenant_id)"
        + " VALUES (#{id}, #{scenarioId}, #{taskId}, #{level}, #{minScore}, #{maxScore}, #{description}, #{color}, #{tenantId})")
    int insertGradeMapping(@Param("id") String id, @Param("scenarioId") String scenarioId,
                           @Param("taskId") String taskId, @Param("level") String level,
                           @Param("minScore") BigDecimal minScore, @Param("maxScore") BigDecimal maxScore,
                           @Param("description") String description, @Param("color") String color,
                           @Param("tenantId") String tenantId);

    /**
     * 重映射任务依赖（dependency_ids 按旧→新任务 ID 映射后回写）。
     */
    @Update("UPDATE scenario_tasks SET dependency_ids = #{newDeps} WHERE id = #{taskId}")
    int updateDependencyIds(@Param("taskId") String taskId, @Param("newDeps") String newDeps);

    // ---------- 源行类型 ----------

    /** 源场景行（数组列以 JSON 文本返回）。 */
    class SourceScenarioRow {
        private String name;
        private String code;
        private String coverImage;
        private String careerPositionId;
        private String industryIds;
        private String professionIds;
        private String batchId;
        private Integer difficulty;
        private String version;
        private String background;
        private String deliveryGoal;
        private String coBuilderIds;
        private String tenantId;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getCoverImage() {
            return coverImage;
        }

        public void setCoverImage(String coverImage) {
            this.coverImage = coverImage;
        }

        public String getCareerPositionId() {
            return careerPositionId;
        }

        public void setCareerPositionId(String careerPositionId) {
            this.careerPositionId = careerPositionId;
        }

        public String getIndustryIds() {
            return industryIds;
        }

        public void setIndustryIds(String industryIds) {
            this.industryIds = industryIds;
        }

        public String getProfessionIds() {
            return professionIds;
        }

        public void setProfessionIds(String professionIds) {
            this.professionIds = professionIds;
        }

        public String getBatchId() {
            return batchId;
        }

        public void setBatchId(String batchId) {
            this.batchId = batchId;
        }

        public Integer getDifficulty() {
            return difficulty;
        }

        public void setDifficulty(Integer difficulty) {
            this.difficulty = difficulty;
        }

        public String getVersion() {
            return version;
        }

        public void setVersion(String version) {
            this.version = version;
        }

        public String getBackground() {
            return background;
        }

        public void setBackground(String background) {
            this.background = background;
        }

        public String getDeliveryGoal() {
            return deliveryGoal;
        }

        public void setDeliveryGoal(String deliveryGoal) {
            this.deliveryGoal = deliveryGoal;
        }

        public String getCoBuilderIds() {
            return coBuilderIds;
        }

        public void setCoBuilderIds(String coBuilderIds) {
            this.coBuilderIds = coBuilderIds;
        }

        public String getTenantId() {
            return tenantId;
        }

        public void setTenantId(String tenantId) {
            this.tenantId = tenantId;
        }
    }

    /** 源任务行。 */
    class TaskSourceRow {
        private String id;
        private String name;
        private String code;
        private Integer sortOrder;
        private String description;
        private String detailedDescription;
        private String descriptionPdf;
        private BigDecimal estimatedHours;
        private String taskType;
        private Integer difficulty;
        private String background;
        private String dependencyIds;
        private String knowledgePointIds;
        private String abilityPointIds;
        private String resourceIds;
        private String evalData;

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

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public Integer getSortOrder() {
            return sortOrder;
        }

        public void setSortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getDetailedDescription() {
            return detailedDescription;
        }

        public void setDetailedDescription(String detailedDescription) {
            this.detailedDescription = detailedDescription;
        }

        public String getDescriptionPdf() {
            return descriptionPdf;
        }

        public void setDescriptionPdf(String descriptionPdf) {
            this.descriptionPdf = descriptionPdf;
        }

        public BigDecimal getEstimatedHours() {
            return estimatedHours;
        }

        public void setEstimatedHours(BigDecimal estimatedHours) {
            this.estimatedHours = estimatedHours;
        }

        public String getTaskType() {
            return taskType;
        }

        public void setTaskType(String taskType) {
            this.taskType = taskType;
        }

        public Integer getDifficulty() {
            return difficulty;
        }

        public void setDifficulty(Integer difficulty) {
            this.difficulty = difficulty;
        }

        public String getBackground() {
            return background;
        }

        public void setBackground(String background) {
            this.background = background;
        }

        public String getDependencyIds() {
            return dependencyIds;
        }

        public void setDependencyIds(String dependencyIds) {
            this.dependencyIds = dependencyIds;
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

        public String getResourceIds() {
            return resourceIds;
        }

        public void setResourceIds(String resourceIds) {
            this.resourceIds = resourceIds;
        }

        public String getEvalData() {
            return evalData;
        }

        public void setEvalData(String evalData) {
            this.evalData = evalData;
        }
    }

    /** 源交付物行。 */
    class DeliverableRow {
        private String type;
        private String name;
        private String description;
        private String evaluationPoints;
        private Integer sortOrder;

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
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

        public String getEvaluationPoints() {
            return evaluationPoints;
        }

        public void setEvaluationPoints(String evaluationPoints) {
            this.evaluationPoints = evaluationPoints;
        }

        public Integer getSortOrder() {
            return sortOrder;
        }

        public void setSortOrder(Integer sortOrder) {
            this.sortOrder = sortOrder;
        }
    }

    /** 源测评方法行。 */
    class MethodSourceRow {
        private String id;
        private String methodKey;
        private BigDecimal weight;
        private String evalObject;
        private String scoreType;
        private String evalSubjects;
        private String standardName;
        private String standardMode;
        private String resourceConfig;
        private Integer version;
        private Boolean isEnabled;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
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

        public String getEvalObject() {
            return evalObject;
        }

        public void setEvalObject(String evalObject) {
            this.evalObject = evalObject;
        }

        public String getScoreType() {
            return scoreType;
        }

        public void setScoreType(String scoreType) {
            this.scoreType = scoreType;
        }

        public String getEvalSubjects() {
            return evalSubjects;
        }

        public void setEvalSubjects(String evalSubjects) {
            this.evalSubjects = evalSubjects;
        }

        public String getStandardName() {
            return standardName;
        }

        public void setStandardName(String standardName) {
            this.standardName = standardName;
        }

        public String getStandardMode() {
            return standardMode;
        }

        public void setStandardMode(String standardMode) {
            this.standardMode = standardMode;
        }

        public String getResourceConfig() {
            return resourceConfig;
        }

        public void setResourceConfig(String resourceConfig) {
            this.resourceConfig = resourceConfig;
        }

        public Integer getVersion() {
            return version;
        }

        public void setVersion(Integer version) {
            this.version = version;
        }

        public Boolean getIsEnabled() {
            return isEnabled;
        }

        public void setIsEnabled(Boolean isEnabled) {
            this.isEnabled = isEnabled;
        }
    }

    /** 源评估点行。 */
    class EvalPointSourceRow {
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

    /** 源评分规则行。 */
    class ScoreRuleSourceRow {
        private String name;
        private String description;
        private String rule;
        private BigDecimal weight;
        private Integer sortOrder;

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

    /** 源评审步骤行。 */
    class ReviewStepSourceRow {
        private String label;
        private String description;
        private Boolean enabled;
        private String subjectType;
        private BigDecimal weight;
        private Integer sortOrder;

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

    /** 源权重行。 */
    class WeightSourceRow {
        private String taskId;
        private BigDecimal weight;

        public String getTaskId() {
            return taskId;
        }

        public void setTaskId(String taskId) {
            this.taskId = taskId;
        }

        public BigDecimal getWeight() {
            return weight;
        }

        public void setWeight(BigDecimal weight) {
            this.weight = weight;
        }
    }

    /** 源等级映射行。 */
    class GradeMappingSourceRow {
        private String taskId;
        private String level;
        private BigDecimal minScore;
        private BigDecimal maxScore;
        private String description;
        private String color;

        public String getTaskId() {
            return taskId;
        }

        public void setTaskId(String taskId) {
            this.taskId = taskId;
        }

        public String getLevel() {
            return level;
        }

        public void setLevel(String level) {
            this.level = level;
        }

        public BigDecimal getMinScore() {
            return minScore;
        }

        public void setMinScore(BigDecimal minScore) {
            this.minScore = minScore;
        }

        public BigDecimal getMaxScore() {
            return maxScore;
        }

        public void setMaxScore(BigDecimal maxScore) {
            this.maxScore = maxScore;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getColor() {
            return color;
        }

        public void setColor(String color) {
            this.color = color;
        }
    }
}
