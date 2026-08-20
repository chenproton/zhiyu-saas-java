package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceProject;

import java.util.List;

/**
 * 合作项目 Mapper（alliance_projects 表）。
 *
 * @author zhiyu
 */
public interface AllianceProjectMapper extends BaseMapperPlus<AllianceProject, AllianceProject> {

    String COLS = "id, tenant_id, name, type, description, phase, publish_status, start_date, end_date,"
        + " budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges, is_public, created_by, created_at, updated_at";

    @Insert("INSERT INTO alliance_projects (id, tenant_id, name, type, description, phase, publish_status,"
        + " start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges,"
        + " is_public, created_by, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{type}, #{description}, #{phase}, #{publishStatus},"
        + " #{startDate}, #{endDate}, #{budget}, #{coverImage}, CAST(#{enterpriseIds} AS JSON),"
        + " CAST(#{agreementIds} AS JSON), CAST(#{secondaryColleges} AS JSON), #{isPublic}, #{createdBy}, NOW(), NOW())")
    int insertProject(AllianceProject p);

    @Update("UPDATE alliance_projects SET name = #{name}, type = #{type}, description = #{description},"
        + " phase = #{phase}, publish_status = #{publishStatus}, start_date = #{startDate}, end_date = #{endDate},"
        + " budget = #{budget}, cover_image = #{coverImage}, enterprise_ids = CAST(#{enterpriseIds} AS JSON),"
        + " agreement_ids = CAST(#{agreementIds} AS JSON), secondary_colleges = CAST(#{secondaryColleges} AS JSON),"
        + " is_public = #{isPublic}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateProject(AllianceProject p);

    @Delete("DELETE FROM alliance_projects WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteProject(@Param("id") String id, @Param("tenantId") String tenantId);

    @Update("UPDATE alliance_projects SET view_count = view_count + 1, updated_at = NOW() WHERE id = #{id}")
    int incrementView(@Param("id") String id);

    @Update("UPDATE alliance_achievements SET project_ids = COALESCE(("
        + " SELECT JSON_ARRAYAGG(jt.x) FROM JSON_TABLE(project_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt WHERE jt.x <> #{id}"
        + "), JSON_ARRAY()), updated_at = NOW() WHERE JSON_CONTAINS(project_ids, JSON_QUOTE(#{id}), '$') AND tenant_id = #{tenantId}")
    int removeProjectRefFromAchievements(@Param("id") String id, @Param("tenantId") String tenantId);

    @Update("UPDATE alliance_agreements SET project_ids = COALESCE(("
        + " SELECT JSON_ARRAYAGG(jt.x) FROM JSON_TABLE(project_ids, '$[*]' COLUMNS (x VARCHAR(64) PATH '$')) jt WHERE jt.x <> #{id}"
        + "), JSON_ARRAY()), updated_at = NOW() WHERE JSON_CONTAINS(project_ids, JSON_QUOTE(#{id}), '$') AND tenant_id = #{tenantId}")
    int removeProjectRefFromAgreements(@Param("id") String id, @Param("tenantId") String tenantId);

    // ---- 公开项目（含 progress） ----

    String PUBLIC_COLS = "id, tenant_id, name, type, description, phase, publish_status, start_date, end_date,"
        + " budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges, is_public, created_by, created_at, updated_at";

    String PROGRESS = "COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE m.is_completed) / NULLIF(COUNT(*), 0))"
        + " FROM alliance_project_milestones m WHERE m.project_id = p.id), 0) AS progress";

    @Select("SELECT " + PUBLIC_COLS + ", " + PROGRESS + " FROM alliance_projects p"
        + " WHERE p.is_public = true AND p.tenant_id = #{tenantId} AND EXISTS ("
        + "   SELECT 1 FROM JSON_TABLE(p.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid"
        + "   JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true"
        + "   JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "     AND l.is_public = true AND l.status != 'terminated')"
        + " ORDER BY p.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<AllianceProject> listPublicProjectsByTenant(@Param("tenantId") String tenantId,
                                                     @Param("limit") int limit,
                                                     @Param("offset") int offset);

    @Select("SELECT " + PUBLIC_COLS + ", " + PROGRESS + " FROM alliance_projects p"
        + " WHERE p.is_public = true AND EXISTS ("
        + "   SELECT 1 FROM JSON_TABLE(p.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid"
        + "   JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true)"
        + " ORDER BY p.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<AllianceProject> listPublicProjectsGlobal(@Param("limit") int limit, @Param("offset") int offset);

    @Select("SELECT " + PUBLIC_COLS + ", " + PROGRESS + " FROM alliance_projects p"
        + " WHERE p.id = #{id} AND p.is_public = true AND p.tenant_id = #{tenantId} AND EXISTS ("
        + "   SELECT 1 FROM JSON_TABLE(p.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid"
        + "   JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true"
        + "   JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "     AND l.is_public = true AND l.status != 'terminated')")
    AllianceProject selectPublicProjectByTenant(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("SELECT " + PUBLIC_COLS + ", " + PROGRESS + " FROM alliance_projects p"
        + " WHERE p.id = #{id} AND p.is_public = true AND EXISTS ("
        + "   SELECT 1 FROM JSON_TABLE(p.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid"
        + "   JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true)")
    AllianceProject selectPublicProjectGlobal(@Param("id") String id);
}
