package org.dromara.zhiyu.mapper.alliance;

import lombok.Data;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.EmploymentProject;

import java.util.List;

/**
 * 就业项目 Mapper（alliance_employment_projects 表）。
 *
 * @author zhiyu
 */
public interface EmploymentProjectMapper extends BaseMapperPlus<EmploymentProject, EmploymentProject> {

    String COLS = "id, tenant_id, name, type, organizer, description, cover_image, start_date, end_date,"
        + " publish_status, enterprise_ids, target_groups, created_by, created_at, updated_at";

    @Insert("INSERT INTO alliance_employment_projects (id, tenant_id, name, type, organizer, description, cover_image,"
        + " start_date, end_date, publish_status, enterprise_ids, target_groups, created_by, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{type}, #{organizer}, #{description}, #{coverImage},"
        + " #{startDate}, #{endDate}, #{publishStatus}, CAST(#{enterpriseIds} AS JSON), CAST(#{targetGroups} AS JSON),"
        + " #{createdBy}, NOW(), NOW())")
    int insertProject(EmploymentProject p);

    @Update("UPDATE alliance_employment_projects SET name = #{name}, type = #{type}, organizer = #{organizer},"
        + " description = #{description}, cover_image = #{coverImage}, start_date = #{startDate}, end_date = #{endDate},"
        + " publish_status = #{publishStatus}, enterprise_ids = CAST(#{enterpriseIds} AS JSON),"
        + " target_groups = CAST(#{targetGroups} AS JSON), updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateProject(EmploymentProject p);

    @Delete("DELETE FROM alliance_employment_projects WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteProject(@Param("id") String id, @Param("tenantId") String tenantId);

    @Data
    class CountRow {
        private Integer jobCount;
        private Integer applicationCount;
    }

    @Select("SELECT (SELECT COUNT(*) FROM alliance_employment_jobs j WHERE j.project_id = p.id) AS job_count,"
        + " (SELECT COUNT(*) FROM alliance_employment_applications a JOIN alliance_employment_jobs j2 ON j2.id = a.job_id"
        + "   WHERE j2.project_id = p.id) AS application_count"
        + " FROM alliance_employment_projects p WHERE p.id = #{id} AND p.tenant_id = #{tenantId}")
    CountRow selectCounts(@Param("id") String id, @Param("tenantId") String tenantId);

    @Data
    class PublicProjectRow {
        private String id;
        private String tenantId;
        private String name;
        private String type;
        private String organizer;
        private String description;
        private String coverImage;
        private java.time.LocalDate startDate;
        private java.time.LocalDate endDate;
        private String publishStatus;
        private String enterpriseIds;
        private String targetGroups;
        private String createdBy;
        private java.time.OffsetDateTime createdAt;
        private java.time.OffsetDateTime updatedAt;
        private Integer jobCount;
    }

    @Select("SELECT p.id, p.tenant_id, p.name, p.type, p.organizer, p.description, p.cover_image,"
        + " p.start_date, p.end_date, p.publish_status, p.enterprise_ids, p.target_groups, p.created_by,"
        + " p.created_at, p.updated_at,"
        + " (SELECT COUNT(*) FROM alliance_employment_jobs j WHERE j.project_id = p.id AND j.status = 'published') AS job_count"
        + " FROM alliance_employment_projects p"
        + " WHERE p.publish_status = 'published' AND p.tenant_id = #{tenantId}"
        + " ORDER BY p.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<PublicProjectRow> listPublicProjects(@Param("tenantId") String tenantId,
                                              @Param("limit") int limit,
                                              @Param("offset") int offset);

    @Select("SELECT " + COLS + " FROM alliance_employment_projects p"
        + " WHERE p.id = #{id} AND p.tenant_id = #{tenantId} AND p.publish_status = 'published'")
    EmploymentProject selectPublicProject(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("<script>SELECT " + COLS + " FROM alliance_employment_projects p"
        + " WHERE JSON_CONTAINS(p.enterprise_ids, JSON_QUOTE(#{enterpriseId}), '$')"
        + " <if test='schoolTenantId != null and schoolTenantId != \"\"'> AND p.tenant_id = #{schoolTenantId}</if>"
        + " ORDER BY p.created_at DESC LIMIT 200</script>")
    List<EmploymentProject> listPartnerProjects(@Param("enterpriseId") String enterpriseId,
                                                @Param("schoolTenantId") String schoolTenantId);

    @Select("SELECT " + COLS + " FROM alliance_employment_projects p"
        + " WHERE p.id = #{id} AND JSON_CONTAINS(p.enterprise_ids, JSON_QUOTE(#{enterpriseId}), '$')")
    EmploymentProject selectPartnerProject(@Param("id") String id, @Param("enterpriseId") String enterpriseId);
}
