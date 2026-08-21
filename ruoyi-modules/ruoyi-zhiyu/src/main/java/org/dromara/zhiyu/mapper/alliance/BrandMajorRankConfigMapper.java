package org.dromara.zhiyu.mapper.alliance;

import lombok.Data;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.BrandMajorRankConfig;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 人才画像排名 Mapper（brand_major_rank_configs + job_ability_results 聚合）。
 *
 * @author zhiyu
 */
public interface BrandMajorRankConfigMapper extends BaseMapperPlus<BrandMajorRankConfig, BrandMajorRankConfig> {

    @Select("SELECT major_id, enabled, rank_limit FROM brand_major_rank_configs WHERE tenant_id = #{tenantId}")
    List<BrandMajorRankConfig> listConfigs(@Param("tenantId") String tenantId);

    @Insert("INSERT INTO brand_major_rank_configs (id, tenant_id, major_id, enabled, rank_limit, created_at, updated_at)"
        + " VALUES ((UUID()), #{tenantId}, #{majorId}, #{enabled}, #{rankLimit}, NOW(), NOW())"
        + " ON DUPLICATE KEY UPDATE enabled = #{enabled}, rank_limit = #{rankLimit}, updated_at = NOW()")
    int saveConfig(@Param("tenantId") String tenantId, @Param("majorId") String majorId,
                   @Param("enabled") boolean enabled, @Param("rankLimit") int rankLimit);

    @Data
    class RankPositionRow {
        private String userId;
        private String positionId;
        private String positionName;
        private Double achievementRate;
        private Double positionCompetency;
        private Double positionCompetencyV2;
        private Double abilityCognitionScore;
        private Integer totalAbilityPoints;
        private Integer achievedAbilityPoints;
        private String grade;
        private OffsetDateTime evaluatedAt;
        private String abilityPointDetails;
    }

    @Select("SELECT jar.user_id, jar.career_position_id AS position_id, COALESCE(cp.name, '') AS position_name,"
        + " jar.achievement_rate, jar.position_competency, jar.position_competency_v2, jar.ability_cognition_score,"
        + " jar.total_ability_points, jar.achieved_ability_points, jar.grade, jar.evaluated_at,"
        + " jar.ability_point_details"
        + " FROM job_ability_results jar LEFT JOIN career_positions cp ON cp.id = jar.career_position_id"
        + " WHERE jar.tenant_id = #{tenantId} ORDER BY jar.evaluated_at DESC")
    List<RankPositionRow> listRankPositions(@Param("tenantId") String tenantId);

    @Data
    class RankStudentRow {
        private String studentId;
        private String studentNo;
        private String name;
        private String majorId;
        private String majorName;
        private String className;
        private String departmentName;
        private Double avgRate;
        private Double avgComp;
        private Double avgCompV2;
        private Double avgCog;
        private Integer posCount;
        private OffsetDateTime latestAt;
    }

    @Select("<script>"
        + "SELECT u.id AS student_id, COALESCE(u.student_no, u.username, u.login_name) AS student_no,"
        + " COALESCE(u.name, '') AS name, mr.eff_major_id AS major_id, COALESCE(mr.eff_major_name, '') AS major_name,"
        + " COALESCE(o.name, '') AS class_name, COALESCE(dept.dept_name, '') AS department_name,"
        + " agg.avg_rate, agg.avg_comp, agg.avg_comp_v2, agg.avg_cog, agg.pos_count, agg.latest_at"
        + " FROM users u"
        + " LEFT JOIN organizations o ON o.id = u.org_node_id"
        + " LEFT JOIN LATERAL ("
        + "   SELECT AVG(jar.achievement_rate) AS avg_rate, AVG(jar.position_competency) AS avg_comp,"
        + "     AVG(jar.position_competency_v2) AS avg_comp_v2, AVG(jar.ability_cognition_score) AS avg_cog,"
        + "     COUNT(*) AS pos_count, MAX(jar.evaluated_at) AS latest_at"
        + "   FROM job_ability_results jar WHERE jar.user_id = u.id AND jar.tenant_id = u.tenant_id"
        + " ) agg ON true"
        + " LEFT JOIN LATERAL ("
        + "   SELECT COALESCE(u.major_id, org_major.matched_id, org_major.org_id) AS eff_major_id,"
        + "     COALESCE(mj.name, org_major.major_name, '') AS eff_major_name"
        + "   FROM ("
        + "     SELECT n.id AS org_id, o2.name AS major_name, mm.id AS matched_id"
        + "     FROM ("
        + "       WITH RECURSIVE org_chain AS ("
        + "         SELECT o3.id, o3.type_id, o3.parent_id, 0 AS depth FROM organizations o3 WHERE o3.id = u.org_node_id"
        + "         UNION ALL"
        + "         SELECT o3.id, o3.type_id, o3.parent_id, c.depth + 1 FROM organizations o3 JOIN org_chain c ON o3.id = c.parent_id"
        + "       )"
        + "       SELECT c.id, c.depth FROM org_chain c"
        + "       JOIN organizations o3 ON o3.id = c.id"
        + "       JOIN org_types t ON t.id = o3.type_id AND t.tenant_id = o3.tenant_id"
        + "       WHERE t.name = '专业' ORDER BY c.depth LIMIT 1"
        + "     ) n"
        + "     JOIN organizations o2 ON o2.id = n.id"
        + "     LEFT JOIN majors mm ON mm.tenant_id = o2.tenant_id AND mm.name = o2.name"
        + "   ) org_major"
        + "   LEFT JOIN majors mj ON mj.id = u.major_id"
        + " ) mr ON true"
        + " LEFT JOIN LATERAL ("
        + "   WITH RECURSIVE org_chain AS ("
        + "     SELECT o4.id, o4.type_id, o4.parent_id, 0 AS depth FROM organizations o4 WHERE o4.id = u.org_node_id"
        + "     UNION ALL"
        + "     SELECT o4.id, o4.type_id, o4.parent_id, c.depth + 1 FROM organizations o4 JOIN org_chain c ON o4.id = c.parent_id"
        + "   )"
        + "   SELECT o4.name AS dept_name FROM org_chain c"
        + "   JOIN organizations o4 ON o4.id = c.id"
        + "   JOIN org_types t ON t.id = o4.type_id AND t.tenant_id = o4.tenant_id"
        + "   WHERE t.name = '二级学院' ORDER BY c.depth LIMIT 1"
        + " ) dept ON true"
        + " WHERE u.tenant_id = #{tenantId}"
        + " AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id WHERE ur.user_id = u.id AND r2.code = 'student')"
        + " <if test='search != null and search != \"\"'> AND (u.name LIKE CONCAT('%', #{search}, '%') OR COALESCE(u.student_no, u.username, u.login_name) LIKE CONCAT('%', #{search}, '%'))</if>"
        + " ORDER BY mr.eff_major_name, agg.avg_rate DESC NULLS LAST, u.name ASC LIMIT 1000"
        + "</script>")
    List<RankStudentRow> listRankStudents(@Param("tenantId") String tenantId, @Param("search") String search);
}
