package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationItem;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationPoint;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationRule;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationTask;
import org.dromara.zhiyu.domain.evaluation.EvaluationCertificationWeight;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 认证规则链 Mapper（certification_rules / _ability_items / _ability_points /
 * _related_tasks / _weights / _point_levels 六表）。
 *
 * @author zhiyu
 */
public interface EvaluationCertificationMapper extends BaseMapperPlus<EvaluationCertificationRule, EvaluationCertificationRule> {

    // ---------- 规则 ----------

    @Insert("INSERT INTO certification_rules (id, tenant_id, career_position_id, status, rule_source)"
        + " VALUES (#{id}, #{tenantId}, #{careerPositionId}, 'draft', #{ruleSource})")
    int insertRule(@Param("id") String id, @Param("tenantId") String tenantId,
                   @Param("careerPositionId") String careerPositionId, @Param("ruleSource") String ruleSource);

    @Update("UPDATE certification_rules SET status = #{status}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateRuleStatus(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);

    @Update("UPDATE certification_rules SET career_position_id = #{careerPositionId}, rule_source = #{ruleSource},"
        + " updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateRule(@Param("id") String id, @Param("tenantId") String tenantId,
                   @Param("careerPositionId") String careerPositionId, @Param("ruleSource") String ruleSource);

    @Update("UPDATE certification_rules SET career_position_id = #{careerPositionId}, rule_source = #{ruleSource},"
        + " level_mapping = #{levelMapping}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateRuleFull(@Param("id") String id, @Param("tenantId") String tenantId,
                       @Param("careerPositionId") String careerPositionId, @Param("ruleSource") String ruleSource,
                       @Param("levelMapping") String levelMapping);

    /** 按岗位查已存在规则（同租户同岗位仅一条） */
    @Select("SELECT id FROM certification_rules WHERE tenant_id = #{tenantId}::uuid AND career_position_id = #{positionId}::uuid LIMIT 1")
    String ruleIdByPosition(@Param("tenantId") String tenantId, @Param("positionId") String positionId);

    /** 查询岗位最新规则（无则 null） */
    @Select("SELECT id, career_position_id::text, status, rule_source, level_mapping::text, created_at, updated_at"
        + " FROM certification_rules WHERE tenant_id = #{tenantId}::uuid AND career_position_id = #{positionId}::uuid"
        + " ORDER BY updated_at DESC LIMIT 1")
    Map<String, Object> findPositionRule(@Param("tenantId") String tenantId, @Param("positionId") String positionId);

    // ---------- 能力项 ----------

    @Insert("INSERT INTO certification_ability_items (id, tenant_id, rule_id, name, sort_order)"
        + " VALUES (#{id}, #{tenantId}, #{ruleId}, #{name}, #{sortOrder})")
    int insertItem(@Param("id") String id, @Param("tenantId") String tenantId, @Param("ruleId") String ruleId,
                   @Param("name") String name, @Param("sortOrder") Integer sortOrder);

    @Update("UPDATE certification_ability_items SET name = #{name}, sort_order = #{sortOrder}"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateItem(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                   @Param("sortOrder") Integer sortOrder);

    /** 全量保存：删除规则下全部能力项（级联删点/任务） */
    @org.apache.ibatis.annotations.Delete("DELETE FROM certification_ability_items WHERE rule_id = #{ruleId}::uuid AND tenant_id = #{tenantId}::uuid")
    int deleteItemsByRule(@Param("ruleId") String ruleId, @Param("tenantId") String tenantId);

    /** 完整项（含能力名，取该条目下排序最前的能力点名称） */
    @Select("SELECT i.id::text AS id, i.name, i.sort_order,"
        + " COALESCE((SELECT ap.name FROM certification_ability_points p"
        + "  JOIN ability_points ap ON ap.id = p.ability_point_id"
        + "  WHERE p.item_id = i.id ORDER BY p.id LIMIT 1), '') AS ability_name"
        + " FROM certification_ability_items i WHERE i.rule_id = #{ruleId}::uuid ORDER BY i.sort_order")
    List<Map<String, Object>> listFullItems(@Param("ruleId") String ruleId);

    // ---------- 能力点 ----------

    @Insert("INSERT INTO certification_ability_points (id, tenant_id, item_id, ability_point_id, mapping_type,"
        + " custom_level_mapping, required_level, weight)"
        + " VALUES (#{id}, #{tenantId}, #{itemId}, #{abilityPointId}, #{mappingType}, #{customLevelMapping},"
        + " #{requiredLevel}, #{weight})")
    int insertPoint(@Param("id") String id, @Param("tenantId") String tenantId, @Param("itemId") String itemId,
                    @Param("abilityPointId") String abilityPointId, @Param("mappingType") String mappingType,
                    @Param("customLevelMapping") String customLevelMapping, @Param("requiredLevel") String requiredLevel,
                    @Param("weight") BigDecimal weight);

    @Update("UPDATE certification_ability_points SET mapping_type = #{mappingType},"
        + " custom_level_mapping = #{customLevelMapping}, required_level = #{requiredLevel}, weight = #{weight}"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updatePoint(@Param("id") String id, @Param("tenantId") String tenantId, @Param("mappingType") String mappingType,
                    @Param("customLevelMapping") String customLevelMapping, @Param("requiredLevel") String requiredLevel,
                    @Param("weight") BigDecimal weight);

    @org.apache.ibatis.annotations.Delete("DELETE FROM certification_ability_points WHERE item_id = #{itemId}::uuid AND tenant_id = #{tenantId}::uuid")
    int deletePointsByItem(@Param("itemId") String itemId, @Param("tenantId") String tenantId);

    /** 完整点（含能力名/描述） */
    @Select("<script>SELECT p.id::text AS id, p.item_id::text AS item_id,"
        + " COALESCE((SELECT name FROM ability_points WHERE id = p.ability_point_id), '') AS name,"
        + " COALESCE((SELECT description FROM ability_points WHERE id = p.ability_point_id), '') AS description,"
        + " p.mapping_type, p.custom_level_mapping::text AS custom_level_mapping, p.required_level, p.weight"
        + " FROM certification_ability_points p WHERE p.item_id IN"
        + " <foreach collection='itemIds' item='itemId' open='(' separator=',' close=')'>#{itemId}::uuid</foreach>"
        + " ORDER BY p.item_id, p.id</script>")
    List<Map<String, Object>> listFullPoints(@Param("itemIds") List<String> itemIds);

    /** 能力点必须存在且属于本租户（防悬挂/跨租户引用） */
    @Select("SELECT EXISTS(SELECT 1 FROM ability_points WHERE id = #{abilityPointId}::uuid AND tenant_id = #{tenantId}::uuid)")
    boolean abilityPointExists(@Param("abilityPointId") String abilityPointId, @Param("tenantId") String tenantId);

    // ---------- 关联任务 ----------

    @Insert("INSERT INTO certification_related_tasks (id, tenant_id, cert_point_id, task_id, max_score, weight)"
        + " VALUES (#{id}, #{tenantId}, #{certPointId}, #{taskId}, #{maxScore}, #{weight})")
    int insertTask(@Param("id") String id, @Param("tenantId") String tenantId, @Param("certPointId") String certPointId,
                   @Param("taskId") String taskId, @Param("maxScore") BigDecimal maxScore,
                   @Param("weight") BigDecimal weight);

    @Update("UPDATE certification_related_tasks SET task_id = #{taskId}, max_score = #{maxScore}, weight = #{weight}"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateTask(@Param("id") String id, @Param("tenantId") String tenantId, @Param("taskId") String taskId,
                   @Param("maxScore") BigDecimal maxScore, @Param("weight") BigDecimal weight);

    /** 按能力点 ID 批量查询关联任务 */
    @Select("<script>SELECT id::text AS id, cert_point_id::text AS cert_point_id, task_id::text AS task_id,"
        + " max_score, weight FROM certification_related_tasks WHERE cert_point_id IN"
        + " <foreach collection='pointIds' item='pointId' open='(' separator=',' close=')'>#{pointId}::uuid</foreach>"
        + " ORDER BY id</script>")
    List<Map<String, Object>> listTasksByPointIds(@Param("pointIds") List<String> pointIds);

    // ---------- 权重 ----------

    @org.apache.ibatis.annotations.Delete("DELETE FROM certification_weights WHERE rule_id = #{ruleId}::uuid")
    int deleteWeightsByRule(@Param("ruleId") String ruleId);

    /** 只删单个能力点的任务权重（task_id IS NOT NULL），不影响其它能力点与能力点级权重 */
    @org.apache.ibatis.annotations.Delete("DELETE FROM certification_weights"
        + " WHERE rule_id = #{ruleId}::uuid AND ability_point_id = #{abilityPointId}::uuid AND task_id IS NOT NULL")
    int deleteTaskWeightsByPoint(@Param("ruleId") String ruleId, @Param("abilityPointId") String abilityPointId);

    @Insert("INSERT INTO certification_weights (id, rule_id, ability_point_id, task_id, weight, tenant_id)"
        + " VALUES (#{id}, #{ruleId}, #{abilityPointId}, #{taskId}, #{weight}, #{tenantId})")
    int insertWeight(@Param("id") String id, @Param("ruleId") String ruleId,
                     @Param("abilityPointId") String abilityPointId, @Param("taskId") String taskId,
                     @Param("weight") BigDecimal weight, @Param("tenantId") String tenantId);

    /** 岗位能力模型：岗位→能力域→能力点（position_ability_bindings 去重） */
    @Select("SELECT b.ability_point_id::text AS ability_point_id, COALESCE(b.domain, '') AS domain_name,"
        + " COALESCE(b.required_level, '') AS required_level, COALESCE(b.rubric_description, '') AS rubric_description,"
        + " COALESCE(ap.name, '') AS name, COALESCE(ap.description, '') AS description"
        + " FROM position_ability_bindings b LEFT JOIN ability_points ap ON ap.id = b.ability_point_id"
        + " WHERE b.career_position_id = #{positionId}::uuid AND b.tenant_id = #{tenantId}::uuid"
        + " ORDER BY b.id")
    List<Map<String, Object>> loadModelBindings(@Param("positionId") String positionId, @Param("tenantId") String tenantId);

    /** 岗位能力模型：能力点→关联任务（场景评分点关联链） */
    @Select("<script>SELECT DISTINCT u.ap_id::text AS ap_id, t.id::text AS task_id, COALESCE(t.name, '') AS task_name,"
        + " COALESCE(s.name, '') AS scenario_name"
        + " FROM scenarios s JOIN scenario_tasks t ON t.scenario_id = s.id"
        + " JOIN task_evaluation_methods m ON m.task_id = t.id AND m.is_enabled = TRUE"
        + " JOIN task_eval_points p ON p.config_id = m.id"
        + " CROSS JOIN LATERAL unnest(p.ability_point_ids) AS u(ap_id)"
        + " WHERE s.career_position_id = #{positionId}::uuid AND m.tenant_id = #{tenantId}::uuid AND u.ap_id IN"
        + " <foreach collection='pointIds' item='pointId' open='(' separator=',' close=')'>#{pointId}::uuid</foreach>"
        + " ORDER BY u.ap_id, t.id</script>")
    List<Map<String, Object>> loadModelTasks(@Param("positionId") String positionId, @Param("tenantId") String tenantId,
                                             @Param("pointIds") List<String> pointIds);

    /** 岗位能力模型：能力点→关联任务（scenario_tasks.ability_point_ids 直接关联） */
    @Select("<script>SELECT DISTINCT u.ap_id::text AS ap_id, t.id::text AS task_id, COALESCE(t.name, '') AS task_name,"
        + " COALESCE(s.name, '') AS scenario_name"
        + " FROM scenarios s JOIN scenario_tasks t ON t.scenario_id = s.id"
        + " CROSS JOIN LATERAL unnest(t.ability_point_ids) AS u(ap_id)"
        + " WHERE s.career_position_id = #{positionId}::uuid AND u.ap_id IN"
        + " <foreach collection='pointIds' item='pointId' open='(' separator=',' close=')'>#{pointId}::uuid</foreach>"
        + " ORDER BY u.ap_id, t.id</script>")
    List<Map<String, Object>> loadModelTasksDirect(@Param("positionId") String positionId,
                                                   @Param("pointIds") List<String> pointIds);

    /** 岗位能力模型：已存权重（task_id 为 NULL 的行是能力点级权重） */
    @Select("SELECT ability_point_id::text AS ability_point_id, task_id::text AS task_id, weight"
        + " FROM certification_weights WHERE rule_id = #{ruleId}::uuid")
    List<Map<String, Object>> loadWeights(@Param("ruleId") String ruleId);

    /** 能力点自定义五档分数线（无配置为空） */
    @Select("SELECT ability_point_id::text AS ability_point_id, level_mapping::text AS level_mapping"
        + " FROM certification_point_levels WHERE tenant_id = #{tenantId}::uuid AND career_position_id = #{positionId}::uuid")
    List<Map<String, Object>> listPointLevels(@Param("tenantId") String tenantId, @Param("positionId") String positionId);

    /** 保存能力点自定义五档分数线（upsert） */
    @Update("INSERT INTO certification_point_levels (tenant_id, career_position_id, ability_point_id, level_mapping)"
        + " VALUES (#{tenantId}, #{careerPositionId}, #{abilityPointId}, #{levelMapping})"
        + " ON CONFLICT (tenant_id, career_position_id, ability_point_id) DO UPDATE SET"
        + " level_mapping = EXCLUDED.level_mapping, updated_at = NOW()")
    int upsertPointLevels(@Param("tenantId") String tenantId, @Param("careerPositionId") String careerPositionId,
                          @Param("abilityPointId") String abilityPointId, @Param("levelMapping") String levelMapping);

    /** 岗位租户（认证体系归属校验） */
    @Select("SELECT tenant_id::text FROM career_positions WHERE id = #{positionId}::uuid")
    String positionTenantId(@Param("positionId") String positionId);

    /** 所有已发布认证规则的租户+岗位组合（每日汇聚定时任务用；对齐 Go ListPublishedTargets） */
    @Select("SELECT DISTINCT tenant_id::text AS tenant_id, career_position_id::text AS position_id"
        + " FROM certification_rules WHERE status = 'published' AND tenant_id IS NOT NULL")
    List<Map<String, Object>> listPublishedTargets();
}
