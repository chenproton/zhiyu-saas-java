package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceAchievement;

import java.util.List;

/**
 * 合作成果 Mapper（alliance_achievements 表）。
 *
 * @author zhiyu
 */
public interface AllianceAchievementMapper extends BaseMapperPlus<AllianceAchievement, AllianceAchievement> {

    String COLS = "id, tenant_id, title, type, description, achievement_date, cover_image, attachments,"
        + " citation_reason, images, owner_persons, co_builders, enterprise_ids, project_ids,"
        + " related_positions, related_scenes, related_courses, status, view_count, secondary_colleges,"
        + " is_public, created_by, created_at, updated_at";

    @Insert("INSERT INTO alliance_achievements (id, tenant_id, title, type, description, achievement_date,"
        + " cover_image, attachments, citation_reason, images, owner_persons, co_builders, enterprise_ids,"
        + " project_ids, related_positions, related_scenes, related_courses, status, view_count, secondary_colleges,"
        + " is_public, created_by, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{title}, #{type}, #{description}, #{achievementDate}, #{coverImage},"
        + " CAST(#{attachments} AS JSON), #{citationReason}, CAST(#{images} AS JSON), CAST(#{ownerPersons} AS JSON),"
        + " CAST(#{coBuilders} AS JSON), CAST(#{enterpriseIds} AS JSON), CAST(#{projectIds} AS JSON),"
        + " CAST(#{relatedPositions} AS JSON), CAST(#{relatedScenes} AS JSON), CAST(#{relatedCourses} AS JSON),"
        + " #{status}, #{viewCount}, CAST(#{secondaryColleges} AS JSON), #{isPublic}, #{createdBy}, NOW(), NOW())")
    int insertAchievement(AllianceAchievement a);

    @Update("UPDATE alliance_achievements SET title = #{title}, type = #{type}, description = #{description},"
        + " achievement_date = #{achievementDate}, cover_image = #{coverImage}, attachments = CAST(#{attachments} AS JSON),"
        + " citation_reason = #{citationReason}, images = CAST(#{images} AS JSON), owner_persons = CAST(#{ownerPersons} AS JSON),"
        + " co_builders = CAST(#{coBuilders} AS JSON), enterprise_ids = CAST(#{enterpriseIds} AS JSON),"
        + " project_ids = CAST(#{projectIds} AS JSON), related_positions = CAST(#{relatedPositions} AS JSON),"
        + " related_scenes = CAST(#{relatedScenes} AS JSON), related_courses = CAST(#{relatedCourses} AS JSON),"
        + " status = #{status}, secondary_colleges = CAST(#{secondaryColleges} AS JSON), is_public = #{isPublic},"
        + " updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateAchievement(AllianceAchievement a);

    @Delete("DELETE FROM alliance_achievements WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteAchievement(@Param("id") String id, @Param("tenantId") String tenantId);

    @Update("UPDATE alliance_achievements SET view_count = view_count + 1, updated_at = NOW() WHERE id = #{id}")
    int incrementView(@Param("id") String id);

    @Select("SELECT " + COLS + " FROM alliance_achievements a"
        + " WHERE a.is_public = true AND a.tenant_id = #{tenantId} AND ("
        + "   EXISTS (SELECT 1 FROM JSON_TABLE(a.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid"
        + "     JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true"
        + "     JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "       AND l.is_public = true AND l.status != 'terminated')"
        + "   OR EXISTS (SELECT 1 FROM JSON_TABLE(a.project_ids, '$[*]' COLUMNS (e VARCHAR(64) PATH '$')) jt pid"
        + "     JOIN alliance_projects p ON p.id = pid AND p.is_public = true AND p.tenant_id = #{tenantId}"
        + "     JOIN JSON_TABLE(p.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid ON true"
        + "     JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true"
        + "     JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "       AND l.is_public = true AND l.status != 'terminated'))"
        + " ORDER BY a.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<AllianceAchievement> listPublicAchievementsByTenant(@Param("tenantId") String tenantId,
                                                             @Param("limit") int limit,
                                                             @Param("offset") int offset);

    @Select("SELECT " + COLS + " FROM alliance_achievements a"
        + " WHERE a.is_public = true AND ("
        + "   EXISTS (SELECT 1 FROM JSON_TABLE(a.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid"
        + "     JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true)"
        + "   OR EXISTS (SELECT 1 FROM JSON_TABLE(a.project_ids, '$[*]' COLUMNS (e VARCHAR(64) PATH '$')) jt pid"
        + "     JOIN alliance_projects p ON p.id = pid AND p.is_public = true"
        + "     JOIN JSON_TABLE(p.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid ON true"
        + "     JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true))"
        + " ORDER BY a.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<AllianceAchievement> listPublicAchievementsGlobal(@Param("limit") int limit,
                                                           @Param("offset") int offset);

    @Select("SELECT " + COLS + " FROM alliance_achievements a"
        + " WHERE a.id = #{id} AND a.is_public = true AND a.tenant_id = #{tenantId} AND ("
        + "   EXISTS (SELECT 1 FROM JSON_TABLE(a.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid"
        + "     JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true"
        + "     JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "       AND l.is_public = true AND l.status != 'terminated')"
        + "   OR EXISTS (SELECT 1 FROM JSON_TABLE(a.project_ids, '$[*]' COLUMNS (e VARCHAR(64) PATH '$')) jt pid"
        + "     JOIN alliance_projects p ON p.id = pid AND p.is_public = true AND p.tenant_id = #{tenantId}"
        + "     JOIN JSON_TABLE(p.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid ON true"
        + "     JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true"
        + "     JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "       AND l.is_public = true AND l.status != 'terminated'))")
    AllianceAchievement selectPublicAchievementByTenant(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("SELECT " + COLS + " FROM alliance_achievements a"
        + " WHERE a.id = #{id} AND a.is_public = true AND ("
        + "   EXISTS (SELECT 1 FROM JSON_TABLE(a.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid"
        + "     JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true)"
        + "   OR EXISTS (SELECT 1 FROM JSON_TABLE(a.project_ids, '$[*]' COLUMNS (e VARCHAR(64) PATH '$')) jt pid"
        + "     JOIN alliance_projects p ON p.id = pid AND p.is_public = true"
        + "     JOIN JSON_TABLE(p.enterprise_ids, '$[*]' COLUMNS (eid VARCHAR(64) PATH '$')) eid ON true"
        + "     JOIN partner_enterprises pe ON pe.id = eid AND pe.enable_public = true))")
    AllianceAchievement selectPublicAchievementGlobal(@Param("id") String id);
}
