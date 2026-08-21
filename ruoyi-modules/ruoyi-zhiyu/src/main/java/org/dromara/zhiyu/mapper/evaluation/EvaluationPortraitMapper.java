package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationStudentPortrait;

import java.util.List;
import java.util.Map;

/**
 * 学生画像 Mapper（student_ability_portraits 表）。
 *
 * @author zhiyu
 */
public interface EvaluationPortraitMapper extends BaseMapperPlus<EvaluationStudentPortrait, EvaluationStudentPortrait> {

    /** 用户是否属于租户（画像生成/档案创建校验） */
    @Select("SELECT EXISTS(SELECT 1 FROM users WHERE id = #{userId} AND tenant_id = #{tenantId})")
    boolean userInTenant(@Param("userId") String userId, @Param("tenantId") String tenantId);

    /** 批量学生班级/专业信息（对齐 Go ListProfiles，汇聚用） */
    @Select("<script>SELECT u.id AS user_id, COALESCE(o.name, '') AS class_name,"
        + " u.major_id AS major_id, COALESCE(m.name, '') AS major_name"
        + " FROM users u LEFT JOIN organizations o ON o.id = u.org_node_id"
        + " LEFT JOIN majors m ON m.id = u.major_id WHERE u.id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></script>")
    List<Map<String, Object>> listProfiles(@Param("ids") List<String> ids);

    /** 推荐岗位（该用户所有岗位汇聚结果按达标率排序前 3） */
    @Select("SELECT r.career_position_id AS position_id, COALESCE(cp.name, '') AS position_name,"
        + " r.achievement_rate AS match_rate, COALESCE(r.grade, '') AS grade"
        + " FROM job_ability_results r LEFT JOIN career_positions cp ON cp.id = r.career_position_id"
        + " WHERE r.user_id = #{userId} ORDER BY r.achievement_rate DESC LIMIT 3")
    List<Map<String, Object>> fetchRecommendPositions(@Param("userId") String userId);

    /** 汇聚后 upsert 画像（对齐 Go UpsertPortrait） */
    @Update("INSERT INTO student_ability_portraits (tenant_id, user_id, career_position_id, overall_grade,"
        + " domain_scores, recommend_positions, updated_at)"
        + " VALUES (#{tenantId}, #{userId}, #{positionId}, NULL, #{domainScores}, #{recommendPositions}, NOW())"
        + " ON DUPLICATE KEY UPDATE"
        + " tenant_id = VALUES(tenant_id), overall_grade = VALUES(overall_grade),"
        + " domain_scores = VALUES(domain_scores), recommend_positions = VALUES(recommend_positions),"
        + " updated_at = VALUES(updated_at)")
    int upsertPortrait(@Param("tenantId") String tenantId, @Param("userId") String userId,
                       @Param("positionId") String positionId, @Param("domainScores") String domainScores,
                       @Param("recommendPositions") String recommendPositions);
}
