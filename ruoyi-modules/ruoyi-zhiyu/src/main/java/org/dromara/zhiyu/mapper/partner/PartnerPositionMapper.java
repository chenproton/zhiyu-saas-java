package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobCareerPosition;

import java.math.BigDecimal;
import java.util.List;

/**
 * 企业共建岗位 Mapper（career_positions 及其子表，Go→Java 迁移）。
 *
 * <p>基础读取走 MyBatis-Plus 内置 selectById/selectList（数组列经 PgArrayTypeHandler 映射）；
 * 可见性过滤/写入走自定义 SQL（数组/jsonb 需显式 CAST）。</p>
 *
 * @author zhiyu
 */
public interface PartnerPositionMapper extends BaseMapperPlus<JobCareerPosition, JobCareerPosition> {

    // ===== 可见性列表（source_enterprise_id 或 grant） =====

    @Select("<script>SELECT cp.id::text FROM career_positions cp"
        + " WHERE (cp.source_enterprise_id = #{enterpriseId}::uuid"
        + "   OR EXISTS (SELECT 1 FROM alliance_resource_grants g WHERE g.enterprise_id = #{enterpriseId}::uuid AND g.resource_type = 'position' AND cp.id = ANY(g.resource_ids)))"
        + " <if test=\"schoolTenantId != null and schoolTenantId != ''\"> AND cp.tenant_id = #{schoolTenantId}::uuid</if>"
        + " <if test=\"search != null and search != ''\"> AND cp.name ILIKE '%' || #{search} || '%'</if>"
        + " ORDER BY cp.updated_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<String> selectPositionIds(@Param("enterpriseId") String enterpriseId,
                                   @Param("schoolTenantId") String schoolTenantId,
                                   @Param("search") String search, @Param("limit") int limit,
                                   @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM career_positions cp"
        + " WHERE (cp.source_enterprise_id = #{enterpriseId}::uuid"
        + "   OR EXISTS (SELECT 1 FROM alliance_resource_grants g WHERE g.enterprise_id = #{enterpriseId}::uuid AND g.resource_type = 'position' AND cp.id = ANY(g.resource_ids)))"
        + " <if test=\"schoolTenantId != null and schoolTenantId != ''\"> AND cp.tenant_id = #{schoolTenantId}::uuid</if>"
        + " <if test=\"search != null and search != ''\"> AND cp.name ILIKE '%' || #{search} || '%'</if></script>")
    long countPositions(@Param("enterpriseId") String enterpriseId, @Param("schoolTenantId") String schoolTenantId,
                        @Param("search") String search);

    @Select("<script>SELECT cp.id, t.name FROM career_positions cp JOIN tenants t ON t.id = cp.tenant_id WHERE cp.id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}::uuid</foreach></script>")
    List<IdNameRow> selectSchoolNames(@Param("ids") List<String> ids);

    @Select("<script>SELECT career_position_id, major_id FROM career_position_majors WHERE career_position_id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}::uuid</foreach></script>")
    List<PosMajorRow> selectPositionMajorIds(@Param("ids") List<String> ids);

    @Select("<script>SELECT id, name FROM majors WHERE id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}::uuid</foreach></script>")
    List<IdNameRow> selectMajorNames(@Param("ids") List<String> ids);

    @Select("<script>SELECT id, name FROM users WHERE id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}::uuid</foreach></script>")
    List<IdNameRow> selectUserNames(@Param("ids") List<String> ids);

    // ===== 写入 =====

    @Insert("INSERT INTO career_positions (id, tenant_id, code, batch_id, name, short_name, industry_id, position_type,"
        + " salary_min, salary_max, cover_image, description, requirements, career_path, version, status, created_by,"
        + " collaborators, source_type, source_enterprise_id, source_resource_id)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{batchId}, #{name}, #{shortName}, #{industryId}, #{positionType},"
        + " #{salaryMin}, #{salaryMax}, #{coverImage}, #{description},"
        + " CAST(#{requirements, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS text[]),"
        + " #{careerPath}, #{version}, #{status}, #{createdBy},"
        + " CAST(#{collaborators, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " #{sourceType}, #{sourceEnterpriseId}, #{sourceResourceId})")
    int insertCoBuildPosition(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                              @Param("batchId") String batchId, @Param("name") String name,
                              @Param("shortName") String shortName, @Param("industryId") String industryId,
                              @Param("positionType") String positionType, @Param("salaryMin") Integer salaryMin,
                              @Param("salaryMax") Integer salaryMax, @Param("coverImage") String coverImage,
                              @Param("description") String description, @Param("requirements") List<String> requirements,
                              @Param("careerPath") String careerPath, @Param("version") String version,
                              @Param("status") String status, @Param("createdBy") String createdBy,
                              @Param("collaborators") List<String> collaborators, @Param("sourceType") String sourceType,
                              @Param("sourceEnterpriseId") String sourceEnterpriseId,
                              @Param("sourceResourceId") String sourceResourceId);

    @Update("UPDATE career_positions SET batch_id = #{batchId}, name = #{name}, short_name = #{shortName},"
        + " industry_id = #{industryId}, position_type = #{positionType}, salary_min = #{salaryMin},"
        + " salary_max = #{salaryMax}, cover_image = #{coverImage}, description = #{description},"
        + " requirements = CAST(#{requirements, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS text[]),"
        + " career_path = #{careerPath}, version = #{version},"
        + " collaborators = CAST(#{collaborators, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]),"
        + " updated_at = NOW() WHERE id = #{id}::uuid")
    int updateCoBuildPosition(@Param("id") String id, @Param("batchId") String batchId, @Param("name") String name,
                              @Param("shortName") String shortName, @Param("industryId") String industryId,
                              @Param("positionType") String positionType, @Param("salaryMin") Integer salaryMin,
                              @Param("salaryMax") Integer salaryMax, @Param("coverImage") String coverImage,
                              @Param("description") String description, @Param("requirements") List<String> requirements,
                              @Param("careerPath") String careerPath, @Param("version") String version,
                              @Param("collaborators") List<String> collaborators);

    /** 状态流转（CAS，对齐 Go ContentActions.Transition）。 */
    @Update("UPDATE career_positions SET status = #{to}, updated_at = NOW()"
        + " WHERE id = #{id}::uuid AND tenant_id = #{tenantId}::uuid AND status = #{current}")
    int casTransition(@Param("id") String id, @Param("tenantId") String tenantId, @Param("current") String current,
                      @Param("to") String to);

    @Select("SELECT status FROM career_positions WHERE id = #{id}::uuid")
    String selectStatus(@Param("id") String id);

    @Select("SELECT EXISTS(SELECT 1 FROM career_positions WHERE tenant_id = #{tenantId}::uuid AND code = #{code})")
    boolean existsCode(@Param("tenantId") String tenantId, @Param("code") String code);

    @Select("SELECT tenant_id::text FROM career_positions WHERE id = #{id}::uuid")
    String selectTenantId(@Param("id") String id);

    /** 查询本企业对该源资源未完结的编辑 draft（对齐 FindDraftBySource）。 */
    @Select("SELECT id::text FROM career_positions WHERE source_enterprise_id = #{enterpriseId}::uuid"
        + " AND source_resource_id = #{sourceResourceId}::uuid AND status IN ('draft','pending','rejected') LIMIT 1")
    String selectDraftIdBySource(@Param("enterpriseId") String enterpriseId,
                                 @Param("sourceResourceId") String sourceResourceId);

    /** 删除保护：存在成绩/画像或被已发布场景引用时拒绝删除。 */
    @Select("SELECT EXISTS(SELECT 1 FROM job_ability_results WHERE career_position_id = #{id}::uuid)"
        + " OR EXISTS(SELECT 1 FROM student_ability_portraits WHERE career_position_id = #{id}::uuid)"
        + " OR EXISTS(SELECT 1 FROM scenarios WHERE career_position_id = #{id}::uuid AND status = 'published')")
    boolean existsInUse(@Param("id") String id);

    @Delete("DELETE FROM job_ability_results WHERE career_position_id = #{id}::uuid")
    int cleanupJobAbilityResults(@Param("id") String id);

    @Delete("DELETE FROM student_ability_portraits WHERE career_position_id = #{id}::uuid")
    int cleanupStudentPortraits(@Param("id") String id);

    @Delete("DELETE FROM job_ability_aggregate_logs WHERE career_position_id = #{id}::uuid")
    int cleanupAggregateLogs(@Param("id") String id);

    @Delete("DELETE FROM view_counters WHERE target_type = 'career_position' AND target_id = #{id}::uuid")
    int cleanupViewCounters(@Param("id") String id);

    @Delete("DELETE FROM favorite_counters WHERE target_type = 'career_position' AND target_id = #{id}::uuid")
    int cleanupFavoriteCounters(@Param("id") String id);

    @Delete("DELETE FROM career_positions WHERE id = #{id}::uuid")
    int deletePositionById(@Param("id") String id);

    // ===== 专业绑定 =====

    @Delete("DELETE FROM career_position_majors WHERE career_position_id = #{positionId}::uuid")
    int deleteMajors(@Param("positionId") String positionId);

    @Insert("INSERT INTO career_position_majors (career_position_id, major_id) VALUES (#{positionId}::uuid, #{majorId}::uuid)")
    int insertMajor(@Param("positionId") String positionId, @Param("majorId") String majorId);

    // ===== 岗位职责 =====

    @Delete("DELETE FROM position_responsibilities WHERE career_position_id = #{positionId}::uuid")
    int deleteResponsibilities(@Param("positionId") String positionId);

    @Insert("INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, description, sort_order)"
        + " VALUES (#{id}, #{tenantId}, #{positionId}, #{name}, #{description}, #{sortOrder})")
    int insertResponsibility(@Param("id") String id, @Param("tenantId") String tenantId,
                             @Param("positionId") String positionId, @Param("name") String name,
                             @Param("description") String description, @Param("sortOrder") int sortOrder);

    // ===== 证书 =====

    @Delete("DELETE FROM position_certificates WHERE career_position_id = #{positionId}::uuid")
    int deleteCertificates(@Param("positionId") String positionId);

    @Insert("INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id)"
        + " VALUES (#{id}, #{tenantId}, #{positionId}, #{libraryId}) ON CONFLICT DO NOTHING")
    int insertCertificate(@Param("id") String id, @Param("tenantId") String tenantId,
                          @Param("positionId") String positionId, @Param("libraryId") String libraryId);

    @Select("SELECT id::text FROM certificate_library WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String selectCertificateLibraryId(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{url}, #{description}, #{imageUrl})")
    int insertCertificateLibrary(@Param("id") String id, @Param("tenantId") String tenantId,
                                 @Param("name") String name, @Param("url") String url,
                                 @Param("description") String description, @Param("imageUrl") String imageUrl);

    // ===== 能力绑定 / 能力域 =====

    @Delete("DELETE FROM ability_domains WHERE career_position_id = #{positionId}::uuid")
    int deleteAbilityDomains(@Param("positionId") String positionId);

    @Delete("DELETE FROM position_ability_bindings WHERE career_position_id = #{positionId}::uuid")
    int deleteAbilityBindings(@Param("positionId") String positionId);

    @Select("INSERT INTO position_ability_bindings (id, tenant_id, career_position_id, responsibility_id, ability_point_id,"
        + " source, domain, required_level, rubric_description, attributes, weight)"
        + " VALUES (#{id}, #{tenantId}, #{positionId}, #{responsibilityId}, #{abilityPointId},"
        + " #{source}, #{domain}, #{requiredLevel}, #{rubricDescription},"
        + " CAST(#{attributes, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS text[]), #{weight})"
        + " ON CONFLICT (career_position_id, responsibility_id, ability_point_id) DO UPDATE SET"
        + " domain = EXCLUDED.domain, required_level = EXCLUDED.required_level,"
        + " rubric_description = EXCLUDED.rubric_description, attributes = EXCLUDED.attributes, weight = EXCLUDED.weight"
        + " RETURNING id")
    String upsertAbilityBindingReturnId(@Param("id") String id, @Param("tenantId") String tenantId,
                                        @Param("positionId") String positionId,
                                        @Param("responsibilityId") String responsibilityId,
                                        @Param("abilityPointId") String abilityPointId, @Param("source") String source,
                                        @Param("domain") String domain, @Param("requiredLevel") String requiredLevel,
                                        @Param("rubricDescription") String rubricDescription,
                                        @Param("attributes") List<String> attributes, @Param("weight") BigDecimal weight);

    @Insert("INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order)"
        + " VALUES (#{id}, #{tenantId}, #{positionId}, #{name}, #{description},"
        + " CAST(#{bindingIds, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS uuid[]), #{sortOrder})")
    int insertAbilityDomain(@Param("id") String id, @Param("tenantId") String tenantId,
                            @Param("positionId") String positionId, @Param("name") String name,
                            @Param("description") String description, @Param("bindingIds") List<String> bindingIds,
                            @Param("sortOrder") int sortOrder);

    @Select("SELECT id::text FROM ability_points WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String selectAbilityPointId(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO ability_points (id, tenant_id, name, description, code, attributes, is_public)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{description}, #{code},"
        + " CAST(#{attributes, typeHandler=org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler} AS text[]), false)")
    int insertAbilityPoint(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                           @Param("description") String description, @Param("code") String code,
                           @Param("attributes") List<String> attributes);

    // ===== 行类 =====

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

    class PosMajorRow {
        private String careerPositionId;
        private String majorId;

        public String getCareerPositionId() {
            return careerPositionId;
        }

        public void setCareerPositionId(String careerPositionId) {
            this.careerPositionId = careerPositionId;
        }

        public String getMajorId() {
            return majorId;
        }

        public void setMajorId(String majorId) {
            this.majorId = majorId;
        }
    }
}
