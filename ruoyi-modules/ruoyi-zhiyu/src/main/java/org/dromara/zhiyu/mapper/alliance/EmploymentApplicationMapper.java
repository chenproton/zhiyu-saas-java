package org.dromara.zhiyu.mapper.alliance;

import lombok.Data;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.EmploymentApplication;

import java.util.List;

/**
 * 学生投递 Mapper（alliance_employment_applications 表）。
 *
 * @author zhiyu
 */
public interface EmploymentApplicationMapper extends BaseMapperPlus<EmploymentApplication, EmploymentApplication> {

    String FROM = "alliance_employment_applications a"
        + " LEFT JOIN alliance_employment_jobs j ON j.id = a.job_id"
        + " LEFT JOIN partner_enterprises pe ON pe.id = a.enterprise_id"
        + " LEFT JOIN alliance_employment_projects p ON p.id = j.project_id";

    String COLS = "a.id, a.tenant_id, a.job_id, a.enterprise_id, a.student_id, a.student_name, a.student_no,"
        + " a.major_name, a.class_name, a.phone, a.email, a.cover_letter, a.status, a.created_at, a.updated_at,"
        + " COALESCE(j.title, '') AS job_title, COALESCE(pe.name, '') AS enterprise_name,"
        + " COALESCE(p.name, '') AS project_name";

    @Select("<script>"
        + "INSERT INTO alliance_employment_applications (id, tenant_id, job_id, enterprise_id, student_id,"
        + " student_name, student_no, major_name, class_name, phone, email, cover_letter, status, created_at, updated_at)"
        + " SELECT #{id}, j.tenant_id, j.id, j.enterprise_id, u.id, u.name, u.student_no, m.name, o.name,"
        + " u.phone, u.email, #{coverLetter}, 'pending', NOW(), NOW()"
        + " FROM alliance_employment_jobs j"
        + " LEFT JOIN alliance_employment_projects p ON p.id = j.project_id"
        + " JOIN users u ON u.id = #{studentId} AND u.tenant_id = j.tenant_id"
        + " LEFT JOIN majors m ON m.id = u.major_id"
        + " LEFT JOIN organizations o ON o.id = u.org_node_id"
        + " WHERE j.id = #{jobId} AND j.status = 'published' AND (j.project_id IS NULL OR p.publish_status = 'published')"
        + " <if test='orgPathIds != null and orgPathIds != \"\"'> AND (p.target_groups = '[]'::jsonb OR EXISTS ("
        + "   SELECT 1 FROM jsonb_array_elements(p.target_groups) g"
        + "   WHERE (g->>'orgNodeId' IS NULL OR g->>'orgNodeId' = ANY(#{orgPathIds}::text[]))"
        + "     AND (g->>'majorId' IS NULL OR #{majorId}::text = g->>'majorId')"
        + "     AND (g->>'graduateYear' IS NULL OR #{graduateYear} = (g->>'graduateYear')::int)))</if>"
        + "</script>")
    int insertApplication(@Param("id") String id, @Param("jobId") String jobId,
                          @Param("studentId") String studentId, @Param("coverLetter") String coverLetter,
                          @Param("orgPathIds") String orgPathIds, @Param("majorId") String majorId,
                          @Param("graduateYear") Integer graduateYear);

    @Select("SELECT TRUE FROM alliance_employment_jobs j"
        + " LEFT JOIN alliance_employment_projects p ON p.id = j.project_id"
        + " WHERE j.id = #{jobId} AND j.status = 'published' AND (j.project_id IS NULL OR p.publish_status = 'published')")
    Boolean selectJobOpen(@Param("jobId") String jobId);

    @Select("SELECT " + COLS + " FROM " + FROM
        + " WHERE a.tenant_id = #{tenantId} AND a.student_id = #{studentId} ORDER BY a.created_at DESC LIMIT 200")
    List<EmploymentApplication> listMyApplications(@Param("tenantId") String tenantId, @Param("studentId") String studentId);

    @Select("<script>SELECT " + COLS + " FROM " + FROM
        + " WHERE a.tenant_id = #{tenantId}"
        + " <if test='projectId != null and projectId != \"\"'> AND j.project_id = #{projectId}</if>"
        + " <if test='jobId != null and jobId != \"\"'> AND a.job_id = #{jobId}</if>"
        + " <if test='enterpriseId != null and enterpriseId != \"\"'> AND a.enterprise_id = #{enterpriseId}</if>"
        + " <if test='search != null and search != \"\"'> AND a.student_name ILIKE '%' || #{search} || '%'</if>"
        + " ORDER BY a.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<EmploymentApplication> listApplications(@Param("tenantId") String tenantId, @Param("projectId") String projectId,
                                                 @Param("jobId") String jobId, @Param("enterpriseId") String enterpriseId,
                                                 @Param("search") String search, @Param("limit") int limit,
                                                 @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM " + FROM
        + " WHERE a.tenant_id = #{tenantId}"
        + " <if test='projectId != null and projectId != \"\"'> AND j.project_id = #{projectId}</if>"
        + " <if test='jobId != null and jobId != \"\"'> AND a.job_id = #{jobId}</if>"
        + " <if test='enterpriseId != null and enterpriseId != \"\"'> AND a.enterprise_id = #{enterpriseId}</if>"
        + " <if test='search != null and search != \"\"'> AND a.student_name ILIKE '%' || #{search} || '%'</if></script>")
    long countApplications(@Param("tenantId") String tenantId, @Param("projectId") String projectId,
                           @Param("jobId") String jobId, @Param("enterpriseId") String enterpriseId,
                           @Param("search") String search);

    @Select("SELECT " + COLS + " FROM " + FROM
        + " WHERE a.job_id = #{jobId} AND a.enterprise_id = #{enterpriseId} ORDER BY a.created_at DESC LIMIT 200")
    List<EmploymentApplication> listPartnerApplications(@Param("jobId") String jobId, @Param("enterpriseId") String enterpriseId);

    @Select("SELECT " + COLS + " FROM " + FROM + " WHERE a.id = #{id} AND a.enterprise_id = #{enterpriseId}")
    EmploymentApplication selectPartnerApplication(@Param("id") String id, @Param("enterpriseId") String enterpriseId);

    @Data
    class StudentScopeRow {
        private String orgNodeId;
        private String majorId;
        private Integer graduateYear;
    }

    @Select("SELECT org_node_id, major_id, graduate_year FROM users WHERE id = #{userId}")
    StudentScopeRow selectStudentScope(@Param("userId") String userId);

    @Select("WITH RECURSIVE up_tree AS ("
        + " SELECT id, parent_id FROM organizations WHERE id = #{orgNodeId}"
        + " UNION ALL"
        + " SELECT o.id, o.parent_id FROM organizations o JOIN up_tree t ON o.id = t.parent_id"
        + ") SELECT COALESCE(array_agg(id::text), '{}') FROM up_tree")
    String selectOrgPathIds(@Param("orgNodeId") String orgNodeId);

    @Select("SELECT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id"
        + " WHERE ur.user_id = #{userId} AND r.code = 'student')")
    boolean isStudent(@Param("userId") String userId);
}
