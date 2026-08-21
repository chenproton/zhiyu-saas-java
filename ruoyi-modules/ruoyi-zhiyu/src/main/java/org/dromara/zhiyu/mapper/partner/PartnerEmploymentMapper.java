package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentApplication;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentJob;
import org.dromara.zhiyu.domain.partner.PartnerEmploymentProject;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 就业服务 Mapper（alliance_employment_projects/jobs/applications，Go→Java 迁移）。
 *
 * <p>岗位基础列读取走 MyBatis-Plus 内置 selectList/selectCount（suitable_majors 经
 * JsonStringListTypeHandler 映射）；项目/投递与关联字段走自定义 @Select。</p>
 *
 * @author zhiyu
 */
public interface PartnerEmploymentMapper extends BaseMapperPlus<PartnerEmploymentJob, PartnerEmploymentJob> {

    // ===== 就业项目（企业端只读） =====

    @Select("<script>SELECT id, tenant_id, name, type, organizer, description, cover_image, start_date, end_date,"
        + " publish_status, enterprise_ids, target_groups, created_by, created_at, updated_at"
        + " FROM alliance_employment_projects p"
        + " WHERE JSON_CONTAINS(p.enterprise_ids, JSON_QUOTE(#{enterpriseId}), '$')"
        + " <if test=\"schoolTenantId != null and schoolTenantId != ''\"> AND p.tenant_id = #{schoolTenantId}</if>"
        + " ORDER BY p.created_at DESC LIMIT 200</script>")
    List<PartnerEmploymentProject> listProjects(@Param("enterpriseId") String enterpriseId,
                                                @Param("schoolTenantId") String schoolTenantId);

    @Select("SELECT id, tenant_id, name, type, organizer, description, cover_image, start_date, end_date,"
        + " publish_status, enterprise_ids, target_groups, created_by, created_at, updated_at"
        + " FROM alliance_employment_projects p"
        + " WHERE p.id = #{id} AND JSON_CONTAINS(p.enterprise_ids, JSON_QUOTE(#{enterpriseId}), '$')")
    PartnerEmploymentProject getProject(@Param("id") String id, @Param("enterpriseId") String enterpriseId);

    // ===== 就业岗位 =====

    @Insert("INSERT INTO alliance_employment_jobs (id, tenant_id, enterprise_id, project_id, title, job_type,"
        + " location, salary_min, salary_max, headcount, education, suitable_majors,"
        + " description, responsibilities, requirements, contact_person, contact_phone, deadline, status, created_by)"
        + " VALUES (#{id}, #{tenantId}, #{enterpriseId}, #{projectId}, #{title}, #{jobType},"
        + " #{location}, #{salaryMin}, #{salaryMax}, #{headcount}, #{education},"
        + " COALESCE(CAST(#{suitableMajors, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " #{description}, #{responsibilities}, #{requirements}, #{contactPerson}, #{contactPhone},"
        + " #{deadline}, #{status}, #{createdBy})")
    int insertJob(@Param("id") String id, @Param("tenantId") String tenantId, @Param("enterpriseId") String enterpriseId,
                  @Param("projectId") String projectId, @Param("title") String title, @Param("jobType") String jobType,
                  @Param("location") String location, @Param("salaryMin") BigDecimal salaryMin,
                  @Param("salaryMax") BigDecimal salaryMax, @Param("headcount") Integer headcount,
                  @Param("education") String education, @Param("suitableMajors") List<String> suitableMajors,
                  @Param("description") String description, @Param("responsibilities") String responsibilities,
                  @Param("requirements") String requirements, @Param("contactPerson") String contactPerson,
                  @Param("contactPhone") String contactPhone, @Param("deadline") LocalDate deadline,
                  @Param("status") String status, @Param("createdBy") String createdBy);

    @Update("UPDATE alliance_employment_jobs SET"
        + " title = #{title}, job_type = #{jobType}, location = #{location}, salary_min = #{salaryMin},"
        + " salary_max = #{salaryMax}, headcount = #{headcount}, education = #{education},"
        + " suitable_majors = COALESCE(CAST(#{suitableMajors, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler} AS JSON), '[]'),"
        + " description = #{description}, responsibilities = #{responsibilities}, requirements = #{requirements},"
        + " contact_person = #{contactPerson}, contact_phone = #{contactPhone}, deadline = #{deadline}, updated_at = NOW()"
        + " WHERE id = #{id} AND enterprise_id = #{enterpriseId}")
    int updateJob(@Param("id") String id, @Param("enterpriseId") String enterpriseId, @Param("title") String title,
                  @Param("jobType") String jobType, @Param("location") String location,
                  @Param("salaryMin") BigDecimal salaryMin, @Param("salaryMax") BigDecimal salaryMax,
                  @Param("headcount") Integer headcount, @Param("education") String education,
                  @Param("suitableMajors") List<String> suitableMajors, @Param("description") String description,
                  @Param("responsibilities") String responsibilities, @Param("requirements") String requirements,
                  @Param("contactPerson") String contactPerson, @Param("contactPhone") String contactPhone,
                  @Param("deadline") LocalDate deadline);

    @Delete("DELETE FROM alliance_employment_jobs WHERE id = #{id} AND enterprise_id = #{enterpriseId}")
    int deleteJob(@Param("id") String id, @Param("enterpriseId") String enterpriseId);

    /** 发布时绑定项目（校验项目归属与企业被分配；0 行命中返回 false）。 */
    @Update("UPDATE alliance_employment_jobs j SET status = #{status}, project_id = #{projectId}, updated_at = NOW()"
        + " FROM alliance_employment_projects p"
        + " WHERE j.id = #{id} AND j.enterprise_id = #{enterpriseId}"
        + " AND p.id = #{projectId} AND JSON_CONTAINS(p.enterprise_ids, JSON_QUOTE(#{enterpriseId}), '$')"
        + " AND p.tenant_id = j.tenant_id")
    int setJobStatusWithProject(@Param("id") String id, @Param("enterpriseId") String enterpriseId,
                                @Param("status") String status, @Param("projectId") String projectId);

    @Update("UPDATE alliance_employment_jobs SET status = #{status}, updated_at = NOW()"
        + " WHERE id = #{id} AND enterprise_id = #{enterpriseId}")
    int setJobStatus(@Param("id") String id, @Param("enterpriseId") String enterpriseId, @Param("status") String status);

    // ===== 投递（企业端只读） =====

    @Select("SELECT a.id, a.tenant_id, a.job_id, a.enterprise_id, a.student_id, a.student_name, a.student_no,"
        + " a.major_name, a.class_name, a.phone, a.email, a.cover_letter, a.status, a.created_at, a.updated_at,"
        + " COALESCE(j.title, '') AS job_title, COALESCE(pe.name, '') AS enterprise_name,"
        + " COALESCE(p.name, '') AS project_name"
        + " FROM alliance_employment_applications a"
        + " LEFT JOIN alliance_employment_jobs j ON j.id = a.job_id"
        + " LEFT JOIN partner_enterprises pe ON pe.id = a.enterprise_id"
        + " LEFT JOIN alliance_employment_projects p ON p.id = j.project_id"
        + " WHERE a.job_id = #{jobId} AND a.enterprise_id = #{enterpriseId}"
        + " ORDER BY a.created_at DESC LIMIT 200")
    List<PartnerEmploymentApplication> listApplications(@Param("jobId") String jobId,
                                                        @Param("enterpriseId") String enterpriseId);

    @Select("SELECT a.id, a.tenant_id, a.job_id, a.enterprise_id, a.student_id, a.student_name, a.student_no,"
        + " a.major_name, a.class_name, a.phone, a.email, a.cover_letter, a.status, a.created_at, a.updated_at,"
        + " COALESCE(j.title, '') AS job_title, COALESCE(pe.name, '') AS enterprise_name,"
        + " COALESCE(p.name, '') AS project_name"
        + " FROM alliance_employment_applications a"
        + " LEFT JOIN alliance_employment_jobs j ON j.id = a.job_id"
        + " LEFT JOIN partner_enterprises pe ON pe.id = a.enterprise_id"
        + " LEFT JOIN alliance_employment_projects p ON p.id = j.project_id"
        + " WHERE a.id = #{id} AND a.enterprise_id = #{enterpriseId} LIMIT 1")
    PartnerEmploymentApplication getApplication(@Param("id") String id, @Param("enterpriseId") String enterpriseId);

    // ===== 批量组装（防 N+1） =====

    @Select("<script>SELECT id, name FROM partner_enterprises WHERE id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}</foreach></script>")
    List<IdNameRow> selectEnterpriseNames(@Param("ids") List<String> ids);

    @Select("<script>SELECT id, name FROM alliance_employment_projects WHERE id IN"
        + " <foreach collection=\"ids\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}</foreach></script>")
    List<IdNameRow> selectProjectNames(@Param("ids") List<String> ids);

    @Select("<script>SELECT job_id, COUNT(*) AS cnt FROM alliance_employment_applications WHERE job_id IN"
        + " <foreach collection=\"jobIds\" item=\"id\" open=\"(\" separator=\",\" close=\")\">#{id}</foreach>"
        + " GROUP BY job_id</script>")
    List<JobCountRow> selectApplicationCounts(@Param("jobIds") List<String> jobIds);

    /** id → name 行。 */
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

    /** job_id → 投递数行。 */
    class JobCountRow {
        private String jobId;
        private long cnt;

        public String getJobId() {
            return jobId;
        }

        public void setJobId(String jobId) {
            this.jobId = jobId;
        }

        public long getCnt() {
            return cnt;
        }

        public void setCnt(long cnt) {
            this.cnt = cnt;
        }
    }
}
