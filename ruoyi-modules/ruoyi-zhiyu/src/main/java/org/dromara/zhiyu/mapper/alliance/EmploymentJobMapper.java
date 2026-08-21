package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.EmploymentJob;

import java.util.List;

/**
 * 就业岗位 Mapper（alliance_employment_jobs 表）。
 *
 * @author zhiyu
 */
public interface EmploymentJobMapper extends BaseMapperPlus<EmploymentJob, EmploymentJob> {

    String FROM = "alliance_employment_jobs j"
        + " LEFT JOIN partner_enterprises pe ON pe.id = j.enterprise_id"
        + " LEFT JOIN alliance_employment_projects p ON p.id = j.project_id"
        + " LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM alliance_employment_applications a WHERE a.job_id = j.id) ac ON true";

    String COLS = "j.id, j.tenant_id, j.enterprise_id, j.project_id, j.title, j.job_type, j.location, j.salary_min,"
        + " j.salary_max, j.headcount, j.education, j.suitable_majors, j.description, j.responsibilities,"
        + " j.requirements, j.contact_person, j.contact_phone, j.deadline, j.status, j.created_by, j.created_at,"
        + " j.updated_at, COALESCE(pe.name, '') AS enterprise_name, COALESCE(p.name, '') AS project_name,"
        + " COALESCE(ac.cnt, 0) AS application_count";

    @Insert("INSERT INTO alliance_employment_jobs (id, tenant_id, enterprise_id, project_id, title, job_type,"
        + " location, salary_min, salary_max, headcount, education, suitable_majors, description, responsibilities,"
        + " requirements, contact_person, contact_phone, deadline, status, created_by, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{enterpriseId}, #{projectId}, #{title}, #{jobType}, #{location},"
        + " #{salaryMin}, #{salaryMax}, #{headcount}, #{education}, CAST(#{suitableMajors} AS JSON),"
        + " #{description}, #{responsibilities}, #{requirements}, #{contactPerson}, #{contactPhone}, #{deadline},"
        + " #{status}, #{createdBy}, NOW(), NOW())")
    int insertJob(EmploymentJob j);

    @Update("UPDATE alliance_employment_jobs SET title = #{title}, job_type = #{jobType}, location = #{location},"
        + " salary_min = #{salaryMin}, salary_max = #{salaryMax}, headcount = #{headcount}, education = #{education},"
        + " suitable_majors = CAST(#{suitableMajors} AS JSON), description = #{description},"
        + " responsibilities = #{responsibilities}, requirements = #{requirements}, contact_person = #{contactPerson},"
        + " contact_phone = #{contactPhone}, deadline = #{deadline}, updated_at = NOW()"
        + " WHERE id = #{id} AND enterprise_id = #{enterpriseId}")
    int updateJob(EmploymentJob j);

    @Delete("DELETE FROM alliance_employment_jobs WHERE id = #{id} AND enterprise_id = #{enterpriseId}")
    int deleteJob(@Param("id") String id, @Param("enterpriseId") String enterpriseId);

    @Update("UPDATE alliance_employment_jobs SET status = #{status}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int adminSetStatus(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);

    @Update("UPDATE alliance_employment_jobs SET status = #{status}, updated_at = NOW()"
        + " WHERE id = #{id} AND enterprise_id = #{enterpriseId}")
    int setPartnerStatus(@Param("id") String id, @Param("enterpriseId") String enterpriseId,
                         @Param("status") String status);

    @Update("UPDATE alliance_employment_jobs j SET status = #{status}, project_id = #{projectId}, updated_at = NOW()"
        + " FROM alliance_employment_projects p"
        + " WHERE j.id = #{id} AND j.enterprise_id = #{enterpriseId} AND p.id = #{projectId}"
        + " AND JSON_CONTAINS(p.enterprise_ids, JSON_QUOTE(#{enterpriseId}), '$') AND p.tenant_id = j.tenant_id")
    int setPartnerStatusWithProject(@Param("id") String id, @Param("enterpriseId") String enterpriseId,
                                    @Param("status") String status, @Param("projectId") String projectId);

    @Select("<script>SELECT " + COLS + " FROM " + FROM
        + " WHERE j.tenant_id = #{tenantId}"
        + " <if test='projectId != null and projectId != \"\"'> AND j.project_id = #{projectId}</if>"
        + " <if test='enterpriseId != null and enterpriseId != \"\"'> AND j.enterprise_id = #{enterpriseId}</if>"
        + " <if test='status != null and status != \"\"'> AND j.status = #{status}</if>"
        + " <if test='search != null and search != \"\"'> AND j.title LIKE CONCAT('%', #{search}, '%')</if>"
        + " ORDER BY j.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<EmploymentJob> listJobs(@Param("tenantId") String tenantId, @Param("projectId") String projectId,
                                 @Param("enterpriseId") String enterpriseId, @Param("status") String status,
                                 @Param("search") String search, @Param("limit") int limit, @Param("offset") int offset);

    @Select("<script>SELECT COUNT(*) FROM " + FROM
        + " WHERE j.tenant_id = #{tenantId}"
        + " <if test='projectId != null and projectId != \"\"'> AND j.project_id = #{projectId}</if>"
        + " <if test='enterpriseId != null and enterpriseId != \"\"'> AND j.enterprise_id = #{enterpriseId}</if>"
        + " <if test='status != null and status != \"\"'> AND j.status = #{status}</if>"
        + " <if test='search != null and search != \"\"'> AND j.title LIKE CONCAT('%', #{search}, '%')</if></script>")
    long countJobs(@Param("tenantId") String tenantId, @Param("projectId") String projectId,
                   @Param("enterpriseId") String enterpriseId, @Param("status") String status,
                   @Param("search") String search);

    @Select("SELECT " + COLS + " FROM " + FROM
        + " WHERE j.project_id = #{projectId} AND j.tenant_id = #{tenantId} AND j.status = 'published'"
        + " ORDER BY j.created_at DESC LIMIT 200")
    List<EmploymentJob> listPublicJobsByProject(@Param("projectId") String projectId, @Param("tenantId") String tenantId);

    @Select("SELECT " + COLS + " FROM " + FROM
        + " WHERE j.id = #{id} AND j.tenant_id = #{tenantId} AND j.status = 'published' AND p.publish_status = 'published'")
    EmploymentJob selectPublicJob(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("<script>SELECT " + COLS + " FROM " + FROM
        + " WHERE j.enterprise_id = #{enterpriseId}"
        + " <if test='projectId != null and projectId != \"\"'> AND j.project_id = #{projectId}</if>"
        + " <if test='status != null and status != \"\"'> AND j.status = #{status}</if>"
        + " ORDER BY j.created_at DESC LIMIT 200</script>")
    List<EmploymentJob> listPartnerJobs(@Param("enterpriseId") String enterpriseId,
                                        @Param("projectId") String projectId,
                                        @Param("status") String status);

    @Select("SELECT " + COLS + " FROM " + FROM + " WHERE j.id = #{id} AND j.enterprise_id = #{enterpriseId}")
    EmploymentJob selectPartnerJob(@Param("id") String id, @Param("enterpriseId") String enterpriseId);
}
