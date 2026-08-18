package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobResourceSnapshot;

import java.util.List;

/**
 * 资源快照 Mapper（resource_snapshots 表，Go→Java 迁移）。
 *
 * <p>快照 bundle 为 jsonb 列，实体以原始 JSON 文本读写。
 * 岗位 live bundle 组装（快照缺档回退用）的 to_jsonb 查询全部沉淀在本 Mapper，
 * 输出列与 Go snapshot_builders.go 的 BuildPositionSnapshot 一致。</p>
 *
 * @author zhiyu
 */
public interface JobResourceSnapshotMapper extends BaseMapperPlus<JobResourceSnapshot, JobResourceSnapshot> {

    /** 资源类型：岗位 */
    String TYPE_POSITION = "position";

    /** 岗位主表快照列（对齐 Go PositionInsertColumns，别名 camelCase 输出） */
    String POSITION_INSERT_COLUMNS = "id, tenant_id AS \"tenantId\", code, batch_id AS \"batchId\","
        + " name, short_name AS \"shortName\", industry_id AS \"industryId\", position_type AS \"positionType\","
        + " salary_min AS \"salaryMin\", salary_max AS \"salaryMax\", cover_image AS \"coverImage\","
        + " description, requirements, career_path AS \"careerPath\", version, status,"
        + " created_by AS \"createdBy\", collaborators";

    /**
     * 查询最新快照版本（资源租户限定）。
     */
    @Select("SELECT version FROM resource_snapshots WHERE tenant_id = #{tenantId}"
        + " AND resource_type = #{resourceType} AND resource_id = #{resourceId}"
        + " ORDER BY created_at DESC LIMIT 1")
    String selectLatestVersion(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                               @Param("resourceId") String resourceId);

    /**
     * 查询指定版本快照内容（jsonb 原文）。
     */
    @Select("SELECT snapshot_data::text FROM resource_snapshots WHERE tenant_id = #{tenantId}"
        + " AND resource_type = #{resourceType} AND resource_id = #{resourceId} AND version = #{version}")
    String selectSnapshotData(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                              @Param("resourceId") String resourceId, @Param("version") String version);

    /**
     * 查询 live 状态（版本 + 状态，回退判定用；仅岗位）。
     */
    @Select("SELECT version, status FROM career_positions WHERE id = #{id} AND tenant_id = #{tenantId}")
    JobLiveState selectPositionLiveState(@Param("id") String id, @Param("tenantId") String tenantId);

    /** live 状态行（version/status）。 */
    class JobLiveState {
        public String version;
        public String status;
    }

    // ---------- 岗位 live bundle 组装（对齐 BuildPositionSnapshot） ----------

    /** 岗位主对象（to_jsonb 单对象）。 */
    @Select("SELECT to_jsonb(t)::text FROM (SELECT " + POSITION_INSERT_COLUMNS
        + " FROM career_positions WHERE id = #{id} AND tenant_id = #{tenantId}) t")
    String buildPositionObj(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 岗位-专业绑定数组（jsonb_agg）。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id AS \"careerPositionId\", major_id AS \"majorId\""
        + " FROM career_position_majors WHERE career_position_id = #{id}) t")
    String buildPositionMajors(@Param("id") String id);

    /** 岗位职责数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id AS \"careerPositionId\", name, description, sort_order AS \"sortOrder\""
        + " FROM position_responsibilities WHERE career_position_id = #{id}) t")
    String buildPositionResponsibilities(@Param("id") String id);

    /** 岗位能力绑定数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id AS \"careerPositionId\", responsibility_id AS \"responsibilityId\","
        + " ability_point_id AS \"abilityPointId\", source, domain, required_level AS \"requiredLevel\","
        + " rubric_description AS \"rubricDescription\", attributes, weight"
        + " FROM position_ability_bindings WHERE career_position_id = #{id}) t")
    String buildPositionAbilityBindings(@Param("id") String id);

    /** 能力域数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id AS \"careerPositionId\", name, description,"
        + " binding_ids AS \"bindingIds\", sort_order AS \"sortOrder\""
        + " FROM ability_domains WHERE career_position_id = #{id}) t")
    String buildAbilityDomains(@Param("id") String id);

    /** 岗位证书数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id AS \"careerPositionId\", certificate_library_id AS \"certificateLibraryId\""
        + " FROM position_certificates WHERE career_position_id = #{id}) t")
    String buildPositionCertificates(@Param("id") String id);

    /** 认定规则数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, career_position_id AS \"careerPositionId\", status, rule_source AS \"ruleSource\","
        + " level_mapping AS \"levelMapping\""
        + " FROM certification_rules WHERE career_position_id = #{id}) t")
    String buildCertificationRules(@Param("id") String id);

    /** 认定权重数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, rule_id AS \"ruleId\", ability_point_id AS \"abilityPointId\", task_id AS \"taskId\", weight"
        + " FROM certification_weights WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{id})) t")
    String buildCertificationWeights(@Param("id") String id);

    /** 认定能力项数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order, t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, rule_id AS \"ruleId\", name, sort_order AS \"sortOrder\""
        + " FROM certification_ability_items WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{id})) t")
    String buildCertificationAbilityItems(@Param("id") String id);

    /** 认定能力点数组。 */
    @Select("SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, item_id AS \"itemId\", ability_point_id AS \"abilityPointId\","
        + " mapping_type AS \"mappingType\", custom_level_mapping AS \"customLevelMapping\","
        + " required_level AS \"requiredLevel\", weight"
        + " FROM certification_ability_points WHERE item_id IN"
        + " (SELECT id FROM certification_ability_items WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{id}))) t")
    String buildCertificationAbilityPoints(@Param("id") String id);

    /**
     * 岗位引用的能力点 ID 集合（绑定 + 认定引用去重；空集合返回空列表）。
     */
    @Select("SELECT COALESCE(array_agg(DISTINCT x)::text[], '{}'::text[]) FROM ("
        + " SELECT pab.ability_point_id AS x FROM position_ability_bindings pab WHERE pab.career_position_id = #{id}"
        + " UNION SELECT cap.ability_point_id FROM certification_ability_points cap"
        + " WHERE cap.item_id IN (SELECT id FROM certification_ability_items WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{id}))) u")
    List<String> collectPositionAbilityPointIds(@Param("id") String id);

    /**
     * 能力点内容数组（按 ID 集合 + 租户）。
     */
    @Select("<script>SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM ("
        + " SELECT id, name, code, description, attributes, is_public AS \"isPublic\","
        + " creator_id AS \"creatorId\", created_at AS \"createdAt\""
        + " FROM ability_points WHERE tenant_id = #{tenantId} AND id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}::uuid</foreach>) t</script>")
    String buildAbilityPoints(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);
}
