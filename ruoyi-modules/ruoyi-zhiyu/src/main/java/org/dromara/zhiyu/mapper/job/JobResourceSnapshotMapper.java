package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobResourceSnapshot;

import java.util.List;

/**
 * 资源快照 Mapper（resource_snapshots 表，Go→Java 迁移）。
 *
 * <p>快照 bundle 为 JSON 列，实体以原始 JSON 文本读写。
 * 岗位 live bundle 组装（快照缺档回退用）的 JSON 组装查询全部沉淀在本 Mapper，
 * 输出列与 Go snapshot_builders.go 的 BuildPositionSnapshot 一致。
 * MySQL 版：原 PG to_jsonb/jsonb_agg 改 JSON_OBJECT / JSON_ARRAYAGG。</p>
 *
 * @author zhiyu
 */
public interface JobResourceSnapshotMapper extends BaseMapperPlus<JobResourceSnapshot, JobResourceSnapshot> {

    /** 资源类型：岗位 */
    String TYPE_POSITION = "position";

    /**
     * 查询最新快照版本（资源租户限定）。
     */
    @Select("SELECT version FROM resource_snapshots WHERE tenant_id = #{tenantId}"
        + " AND resource_type = #{resourceType} AND resource_id = #{resourceId}"
        + " ORDER BY created_at DESC LIMIT 1")
    String selectLatestVersion(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                               @Param("resourceId") String resourceId);

    /**
     * 查询指定版本快照内容（JSON 原文）。
     */
    @Select("SELECT CAST(snapshot_data AS CHAR) FROM resource_snapshots WHERE tenant_id = #{tenantId}"
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

    /** 岗位主对象（JSON_OBJECT 单对象）。 */
    @Select("SELECT JSON_OBJECT("
        + " 'id', cp.id, 'tenantId', cp.tenant_id, 'code', cp.code, 'batchId', cp.batch_id,"
        + " 'name', cp.name, 'shortName', cp.short_name, 'industryId', cp.industry_id, 'positionType', cp.position_type,"
        + " 'salaryMin', cp.salary_min, 'salaryMax', cp.salary_max, 'coverImage', cp.cover_image,"
        + " 'description', cp.description, 'requirements', cp.requirements, 'careerPath', cp.career_path,"
        + " 'version', cp.version, 'status', cp.status, 'createdBy', cp.created_by, 'collaborators', cp.collaborators"
        + ") FROM career_positions cp WHERE cp.id = #{id} AND cp.tenant_id = #{tenantId}")
    String buildPositionObj(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 岗位-专业绑定数组（JSON_ARRAYAGG）。 */
    @Select("SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'careerPositionId', t.career_position_id, 'majorId', t.major_id"
        + ") ORDER BY t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, career_position_id, major_id"
        + " FROM career_position_majors WHERE career_position_id = #{id}) t")
    String buildPositionMajors(@Param("id") String id);

    /** 岗位职责数组。 */
    @Select("SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'careerPositionId', t.career_position_id, 'name', t.name, 'description', t.description, 'sortOrder', t.sort_order"
        + ") ORDER BY t.sort_order, t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, career_position_id, name, description, sort_order"
        + " FROM position_responsibilities WHERE career_position_id = #{id}) t")
    String buildPositionResponsibilities(@Param("id") String id);

    /** 岗位能力绑定数组。 */
    @Select("SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'careerPositionId', t.career_position_id, 'responsibilityId', t.responsibility_id,"
        + " 'abilityPointId', t.ability_point_id, 'source', t.source, 'domain', t.domain, 'requiredLevel', t.required_level,"
        + " 'rubricDescription', t.rubric_description, 'attributes', t.attributes, 'weight', t.weight"
        + ") ORDER BY t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, career_position_id, responsibility_id, ability_point_id, source, domain, required_level,"
        + " rubric_description, attributes, weight"
        + " FROM position_ability_bindings WHERE career_position_id = #{id}) t")
    String buildPositionAbilityBindings(@Param("id") String id);

    /** 能力域数组。 */
    @Select("SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'careerPositionId', t.career_position_id, 'name', t.name, 'description', t.description,"
        + " 'bindingIds', t.binding_ids, 'sortOrder', t.sort_order"
        + ") ORDER BY t.sort_order, t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, career_position_id, name, description, binding_ids, sort_order"
        + " FROM ability_domains WHERE career_position_id = #{id}) t")
    String buildAbilityDomains(@Param("id") String id);

    /** 岗位证书数组。 */
    @Select("SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'careerPositionId', t.career_position_id, 'certificateLibraryId', t.certificate_library_id"
        + ") ORDER BY t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, career_position_id, certificate_library_id"
        + " FROM position_certificates WHERE career_position_id = #{id}) t")
    String buildPositionCertificates(@Param("id") String id);

    /** 认定规则数组。 */
    @Select("SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'careerPositionId', t.career_position_id, 'status', t.status, 'ruleSource', t.rule_source,"
        + " 'levelMapping', t.level_mapping"
        + ") ORDER BY t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, career_position_id, status, rule_source, level_mapping"
        + " FROM certification_rules WHERE career_position_id = #{id}) t")
    String buildCertificationRules(@Param("id") String id);

    /** 认定权重数组。 */
    @Select("SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'ruleId', t.rule_id, 'abilityPointId', t.ability_point_id, 'taskId', t.task_id, 'weight', t.weight"
        + ") ORDER BY t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, rule_id, ability_point_id, task_id, weight"
        + " FROM certification_weights WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{id})) t")
    String buildCertificationWeights(@Param("id") String id);

    /** 认定能力项数组。 */
    @Select("SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'ruleId', t.rule_id, 'name', t.name, 'sortOrder', t.sort_order"
        + ") ORDER BY t.sort_order, t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, rule_id, name, sort_order"
        + " FROM certification_ability_items WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{id})) t")
    String buildCertificationAbilityItems(@Param("id") String id);

    /** 认定能力点数组。 */
    @Select("SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'itemId', t.item_id, 'abilityPointId', t.ability_point_id,"
        + " 'mappingType', t.mapping_type, 'customLevelMapping', t.custom_level_mapping,"
        + " 'requiredLevel', t.required_level, 'weight', t.weight"
        + ") ORDER BY t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, item_id, ability_point_id, mapping_type, custom_level_mapping, required_level, weight"
        + " FROM certification_ability_points WHERE item_id IN"
        + " (SELECT id FROM certification_ability_items WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{id}))) t")
    String buildCertificationAbilityPoints(@Param("id") String id);

    /**
     * 岗位引用的能力点 ID 集合（绑定 + 认定引用去重；空集合返回空列表）。
     * MySQL 版：原 JSON_ARRAYAGG(DISTINCT x) 改 UNION 子查询直接多行返回（MyBatis 映射 List<String> 每行一元素）。
     */
    @Select("SELECT x FROM ("
        + " SELECT pab.ability_point_id AS x FROM position_ability_bindings pab WHERE pab.career_position_id = #{id}"
        + " UNION SELECT cap.ability_point_id FROM certification_ability_points cap"
        + " WHERE cap.item_id IN (SELECT id FROM certification_ability_items WHERE rule_id IN"
        + " (SELECT id FROM certification_rules WHERE career_position_id = #{id}))) u")
    List<String> collectPositionAbilityPointIds(@Param("id") String id);

    /**
     * 能力点内容数组（按 ID 集合 + 租户）。
     */
    @Select("<script>SELECT COALESCE(CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT("
        + " 'id', t.id, 'name', t.name, 'code', t.code, 'description', t.description, 'attributes', t.attributes,"
        + " 'isPublic', t.is_public, 'creatorId', t.creator_id, 'createdAt', t.created_at"
        + ") ORDER BY t.id SEPARATOR ','), ']') AS JSON), '[]') FROM ("
        + " SELECT id, name, code, description, attributes, is_public, creator_id, created_at"
        + " FROM ability_points WHERE tenant_id = #{tenantId} AND id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}</foreach>) t</script>")
    String buildAbilityPoints(@Param("ids") List<String> ids, @Param("tenantId") String tenantId);
}
