package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CoBuildUserOption;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CooperationSchool;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.MentorTask;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 合作内容/统计/测评任务/共建人候选 Mapper（多表只读聚合，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface PartnerCooperationMapper {

    // ===== 合作内容（GET /partner/cooperation） =====

    /** 企业关联的合作学校（link 未终止），按学校名排序。 */
    @Select("SELECT l.tenant_id AS tenantId, t.name AS schoolName"
        + " FROM alliance_enterprise_links l JOIN tenants t ON t.id = l.tenant_id"
        + " WHERE l.enterprise_id = #{enterpriseId}::uuid AND l.status != 'terminated' ORDER BY t.name")
    List<CooperationSchool> listCooperationSchools(@Param("enterpriseId") String enterpriseId);

    @Select("SELECT tenant_id AS tenantId, id, name, phase, is_public AS isPublic, updated_at AS updatedAt FROM ("
        + " SELECT x.tenant_id, x.id, x.name, x.phase, x.is_public, x.updated_at,"
        + " ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.updated_at DESC) rn"
        + " FROM alliance_projects x"
        + " WHERE EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.tenant_id = x.tenant_id AND l.enterprise_id = #{enterpriseId}::uuid AND l.status != 'terminated')"
        + " AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(x.enterprise_ids) eid WHERE eid = #{enterpriseId}::text)"
        + " ) ranked WHERE rn <= 50 ORDER BY updated_at DESC")
    List<ProjectRow> listCooperationProjects(@Param("enterpriseId") String enterpriseId);

    @Select("SELECT tenant_id AS tenantId, id, title, type, is_public AS isPublic, updated_at AS updatedAt FROM ("
        + " SELECT x.tenant_id, x.id, x.title, x.type, x.is_public, x.updated_at,"
        + " ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.updated_at DESC) rn"
        + " FROM alliance_achievements x"
        + " WHERE EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.tenant_id = x.tenant_id AND l.enterprise_id = #{enterpriseId}::uuid AND l.status != 'terminated')"
        + " AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(x.enterprise_ids) eid WHERE eid = #{enterpriseId}::text)"
        + " ) ranked WHERE rn <= 50 ORDER BY updated_at DESC")
    List<AchievementRow> listCooperationAchievements(@Param("enterpriseId") String enterpriseId);

    @Select("SELECT tenant_id AS tenantId, id, name, type, status, is_public AS isPublic, updated_at AS updatedAt FROM ("
        + " SELECT x.tenant_id, x.id, x.name, x.type, x.status, x.is_public, x.updated_at,"
        + " ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.updated_at DESC) rn"
        + " FROM alliance_agreements x"
        + " WHERE EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.tenant_id = x.tenant_id AND l.enterprise_id = #{enterpriseId}::uuid AND l.status != 'terminated')"
        + " AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(x.enterprise_ids) eid WHERE eid = #{enterpriseId}::text)"
        + " ) ranked WHERE rn <= 50 ORDER BY updated_at DESC")
    List<AgreementRow> listCooperationAgreements(@Param("enterpriseId") String enterpriseId);

    // ===== 合作内容详情 =====

    @Select("SELECT x.id, x.name, x.type, x.description, x.phase, x.publish_status AS publishStatus,"
        + " to_char(x.start_date, 'YYYY-MM-DD') AS startDate, to_char(x.end_date, 'YYYY-MM-DD') AS endDate,"
        + " x.budget, x.secondary_colleges AS secondaryColleges, x.is_public AS isPublic,"
        + " x.created_at AS createdAt, x.updated_at AS updatedAt"
        + " FROM alliance_projects x WHERE x.id = #{id}::uuid"
        + " AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.tenant_id = x.tenant_id AND l.enterprise_id = #{enterpriseId}::uuid AND l.status != 'terminated')"
        + " AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(x.enterprise_ids) eid WHERE eid = #{enterpriseId}::text)")
    ProjectDetailRow getCooperationProject(@Param("enterpriseId") String enterpriseId, @Param("id") String id);

    @Select("SELECT id, tenant_id AS tenantId, project_id AS projectId, name, description,"
        + " to_char(due_date, 'YYYY-MM-DD') AS dueDate, to_char(completed_date, 'YYYY-MM-DD') AS completedDate,"
        + " is_completed AS isCompleted"
        + " FROM alliance_project_milestones WHERE project_id = #{projectId}::uuid ORDER BY sort_order, created_at")
    List<MilestoneRow> listMilestones(@Param("projectId") String projectId);

    @Select("SELECT x.id, x.title, x.type, x.description, to_char(x.achievement_date, 'YYYY-MM-DD') AS achievementDate,"
        + " x.citation_reason AS citationReason, x.owner_persons AS ownerPersons, x.co_builders AS coBuilders,"
        + " x.secondary_colleges AS secondaryColleges, x.status, x.view_count AS viewCount,"
        + " x.is_public AS isPublic, x.created_at AS createdAt, x.updated_at AS updatedAt"
        + " FROM alliance_achievements x WHERE x.id = #{id}::uuid"
        + " AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.tenant_id = x.tenant_id AND l.enterprise_id = #{enterpriseId}::uuid AND l.status != 'terminated')"
        + " AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(x.enterprise_ids) eid WHERE eid = #{enterpriseId}::text)")
    AchievementDetailRow getCooperationAchievement(@Param("enterpriseId") String enterpriseId, @Param("id") String id);

    @Select("SELECT x.id, x.name, x.type, x.content, to_char(x.start_date, 'YYYY-MM-DD') AS startDate,"
        + " to_char(x.end_date, 'YYYY-MM-DD') AS endDate, x.status, x.is_public AS isPublic,"
        + " x.created_at AS createdAt, x.updated_at AS updatedAt"
        + " FROM alliance_agreements x WHERE x.id = #{id}::uuid"
        + " AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.tenant_id = x.tenant_id AND l.enterprise_id = #{enterpriseId}::uuid AND l.status != 'terminated')"
        + " AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(x.enterprise_ids) eid WHERE eid = #{enterpriseId}::text)")
    AgreementDetailRow getCooperationAgreement(@Param("enterpriseId") String enterpriseId, @Param("id") String id);

    // ===== 专家测评任务 =====

    @Select("SELECT st.id AS taskId, st.name AS taskName, rs.label AS stepLabel, t.name AS schoolName,"
        + " x.name AS expertName, rs.updated_at AS updatedAt,"
        + " COALESCE(prog.assigned_count, 0) AS assignedCount, COALESCE(prog.graded_count, 0) AS gradedCount"
        + " FROM alliance_experts x"
        + " JOIN alliance_enterprise_links l ON l.enterprise_id = x.enterprise_id"
        + " JOIN tenants t ON t.id = l.tenant_id"
        + " JOIN task_review_steps rs ON rs.tenant_id = l.tenant_id AND x.user_id = ANY(rs.assigned_user_ids) AND rs.enabled = true"
        + " JOIN task_evaluation_methods em ON em.id = rs.config_id AND em.is_enabled = true"
        + " JOIN scenario_tasks st ON st.id = em.task_id"
        + " LEFT JOIN LATERAL (SELECT COUNT(*) AS assigned_count,"
        + "   COUNT(*) FILTER (WHERE er.status = 'evaluated') AS graded_count"
        + "   FROM scene_evaluation_results er"
        + "   WHERE er.task_id = st.id AND er.tenant_id = l.tenant_id AND er.evaluator_id = x.user_id) prog ON true"
        + " WHERE x.enterprise_id = #{enterpriseId}::uuid AND x.user_id IS NOT NULL"
        + " ORDER BY rs.updated_at DESC LIMIT 200")
    List<MentorTask> listMentorTasks(@Param("enterpriseId") String enterpriseId);

    // ===== 统计 =====

    @Select("SELECT COUNT(*) FROM alliance_experts WHERE tenant_id = #{tenantId}::uuid")
    long countExperts(@Param("tenantId") String tenantId);

    @Select("SELECT COUNT(*) FROM alliance_experts WHERE tenant_id = #{tenantId}::uuid AND is_public = true AND status = 'active'")
    long countPublicExperts(@Param("tenantId") String tenantId);

    @Select("SELECT COUNT(*) FROM users WHERE tenant_id = #{tenantId}::uuid AND platform = 'partner'")
    long countMembers(@Param("tenantId") String tenantId);

    @Select("SELECT COUNT(*) FROM career_positions cp WHERE cp.source_enterprise_id = #{enterpriseId}::uuid"
        + " OR EXISTS (SELECT 1 FROM alliance_resource_grants g"
        + " WHERE g.enterprise_id = #{enterpriseId}::uuid AND g.resource_type = 'position' AND cp.id = ANY(g.resource_ids))")
    long countCoBuildPositions(@Param("enterpriseId") String enterpriseId);

    @Select("SELECT COUNT(*) FROM scenarios sc WHERE sc.source_enterprise_id = #{enterpriseId}::uuid"
        + " OR EXISTS (SELECT 1 FROM alliance_resource_grants g"
        + " WHERE g.enterprise_id = #{enterpriseId}::uuid AND g.resource_type = 'scenario' AND sc.id = ANY(g.resource_ids))")
    long countCoBuildScenarios(@Param("enterpriseId") String enterpriseId);

    @Select("SELECT m.month, COALESCE(e.cnt, 0) AS experts, COALESCE(p.cnt, 0) AS positions, COALESCE(sc.cnt, 0) AS scenarios"
        + " FROM (SELECT to_char(d, 'YYYY-MM') AS month FROM generate_series(date_trunc('month', NOW()) - make_interval(months => #{months} - 1), date_trunc('month', NOW()), '1 month') d) m"
        + " LEFT JOIN (SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*) AS cnt FROM alliance_experts"
        + "   WHERE tenant_id = #{tenantId}::uuid AND created_at >= date_trunc('month', NOW()) - make_interval(months => #{months} - 1) GROUP BY 1) e ON e.month = m.month"
        + " LEFT JOIN (SELECT to_char(date_trunc('month', cp.created_at), 'YYYY-MM') AS month, COUNT(*) AS cnt FROM career_positions cp"
        + "   WHERE (cp.source_enterprise_id = #{enterpriseId}::uuid OR EXISTS (SELECT 1 FROM alliance_resource_grants g"
        + "     WHERE g.enterprise_id = #{enterpriseId}::uuid AND g.resource_type = 'position' AND cp.id = ANY(g.resource_ids)))"
        + "   AND cp.created_at >= date_trunc('month', NOW()) - make_interval(months => #{months} - 1) GROUP BY 1) p ON p.month = m.month"
        + " LEFT JOIN (SELECT to_char(date_trunc('month', sc.created_at), 'YYYY-MM') AS month, COUNT(*) AS cnt FROM scenarios sc"
        + "   WHERE (sc.source_enterprise_id = #{enterpriseId}::uuid OR EXISTS (SELECT 1 FROM alliance_resource_grants g"
        + "     WHERE g.enterprise_id = #{enterpriseId}::uuid AND g.resource_type = 'scenario' AND sc.id = ANY(g.resource_ids)))"
        + "   AND sc.created_at >= date_trunc('month', NOW()) - make_interval(months => #{months} - 1) GROUP BY 1) sc ON sc.month = m.month"
        + " ORDER BY m.month")
    List<NewMonthCountRow> countMonthlyNew(@Param("tenantId") String tenantId,
                                           @Param("enterpriseId") String enterpriseId, @Param("months") int months);

    @Select("SELECT m.month, COALESCE(p.cnt, 0) AS projects, COALESCE(a.cnt, 0) AS agreements, COALESCE(c.cnt, 0) AS achievements"
        + " FROM (SELECT to_char(d, 'YYYY-MM') AS month FROM generate_series(date_trunc('month', NOW()) - make_interval(months => #{months} - 1), date_trunc('month', NOW()), '1 month') d) m"
        + " LEFT JOIN (SELECT to_char(date_trunc('month', p.created_at), 'YYYY-MM') AS month, COUNT(*) AS cnt"
        + "   FROM alliance_projects p, jsonb_array_elements_text(p.enterprise_ids) eid WHERE eid = #{enterpriseId}::text"
        + "   AND p.created_at >= date_trunc('month', NOW()) - make_interval(months => #{months} - 1) GROUP BY 1) p ON p.month = m.month"
        + " LEFT JOIN (SELECT to_char(date_trunc('month', a.created_at), 'YYYY-MM') AS month, COUNT(*) AS cnt"
        + "   FROM alliance_agreements a, jsonb_array_elements_text(a.enterprise_ids) eid WHERE eid = #{enterpriseId}::text"
        + "   AND a.created_at >= date_trunc('month', NOW()) - make_interval(months => #{months} - 1) GROUP BY 1) a ON a.month = m.month"
        + " LEFT JOIN (SELECT to_char(date_trunc('month', c.created_at), 'YYYY-MM') AS month, COUNT(*) AS cnt"
        + "   FROM alliance_achievements c, jsonb_array_elements_text(c.enterprise_ids) eid WHERE eid = #{enterpriseId}::text"
        + "   AND c.created_at >= date_trunc('month', NOW()) - make_interval(months => #{months} - 1) GROUP BY 1) c ON c.month = m.month"
        + " ORDER BY m.month")
    List<ContentMonthCountRow> countMonthlyContent(@Param("enterpriseId") String enterpriseId, @Param("months") int months);

    // ===== 共建人候选（合作学校） =====

    @Select("SELECT u.id, u.name FROM users u"
        + " WHERE u.tenant_id = #{schoolTenantId}::uuid AND u.platform = 'portal'"
        + " AND NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code = 'student')"
        + " ORDER BY u.name")
    List<CoBuilderRow> listSchoolTeachers(@Param("schoolTenantId") String schoolTenantId);

    @Select("SELECT x.id AS expertId, x.name, x.title, e.name AS enterpriseName, x.user_id AS userId"
        + " FROM alliance_experts x"
        + " JOIN alliance_enterprise_links l ON l.enterprise_id = x.enterprise_id AND l.tenant_id = #{schoolTenantId}::uuid"
        + " JOIN partner_enterprises e ON e.id = x.enterprise_id"
        + " WHERE x.user_id IS NOT NULL ORDER BY e.name, x.created_at DESC")
    List<CoBuilderRow> listSchoolExperts(@Param("schoolTenantId") String schoolTenantId);

    // ===== 行类 =====

    class ProjectRow {
        private String tenantId;
        private String id;
        private String name;
        private String phase;
        private Boolean isPublic;
        private OffsetDateTime updatedAt;

        public String getTenantId() {
            return tenantId;
        }

        public void setTenantId(String tenantId) {
            this.tenantId = tenantId;
        }

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

        public String getPhase() {
            return phase;
        }

        public void setPhase(String phase) {
            this.phase = phase;
        }

        public Boolean getIsPublic() {
            return isPublic;
        }

        public void setIsPublic(Boolean isPublic) {
            this.isPublic = isPublic;
        }

        public OffsetDateTime getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(OffsetDateTime updatedAt) {
            this.updatedAt = updatedAt;
        }
    }

    class AchievementRow {
        private String tenantId;
        private String id;
        private String title;
        private String type;
        private Boolean isPublic;
        private OffsetDateTime updatedAt;

        public String getTenantId() {
            return tenantId;
        }

        public void setTenantId(String tenantId) {
            this.tenantId = tenantId;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public Boolean getIsPublic() {
            return isPublic;
        }

        public void setIsPublic(Boolean isPublic) {
            this.isPublic = isPublic;
        }

        public OffsetDateTime getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(OffsetDateTime updatedAt) {
            this.updatedAt = updatedAt;
        }
    }

    class AgreementRow {
        private String tenantId;
        private String id;
        private String name;
        private String type;
        private String status;
        private Boolean isPublic;
        private OffsetDateTime updatedAt;

        public String getTenantId() {
            return tenantId;
        }

        public void setTenantId(String tenantId) {
            this.tenantId = tenantId;
        }

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

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public Boolean getIsPublic() {
            return isPublic;
        }

        public void setIsPublic(Boolean isPublic) {
            this.isPublic = isPublic;
        }

        public OffsetDateTime getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(OffsetDateTime updatedAt) {
            this.updatedAt = updatedAt;
        }
    }

    class ProjectDetailRow {
        private String id;
        private String name;
        private String type;
        private String description;
        private String phase;
        private String publishStatus;
        private String startDate;
        private String endDate;
        private String budget;
        private String secondaryColleges;
        private Boolean isPublic;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;

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

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getPhase() {
            return phase;
        }

        public void setPhase(String phase) {
            this.phase = phase;
        }

        public String getPublishStatus() {
            return publishStatus;
        }

        public void setPublishStatus(String publishStatus) {
            this.publishStatus = publishStatus;
        }

        public String getStartDate() {
            return startDate;
        }

        public void setStartDate(String startDate) {
            this.startDate = startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public void setEndDate(String endDate) {
            this.endDate = endDate;
        }

        public String getBudget() {
            return budget;
        }

        public void setBudget(String budget) {
            this.budget = budget;
        }

        public String getSecondaryColleges() {
            return secondaryColleges;
        }

        public void setSecondaryColleges(String secondaryColleges) {
            this.secondaryColleges = secondaryColleges;
        }

        public Boolean getIsPublic() {
            return isPublic;
        }

        public void setIsPublic(Boolean isPublic) {
            this.isPublic = isPublic;
        }

        public OffsetDateTime getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
        }

        public OffsetDateTime getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(OffsetDateTime updatedAt) {
            this.updatedAt = updatedAt;
        }
    }

    class MilestoneRow {
        private String id;
        private String name;
        private String description;
        private String dueDate;
        private String completedDate;
        private Boolean isCompleted;

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

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getDueDate() {
            return dueDate;
        }

        public void setDueDate(String dueDate) {
            this.dueDate = dueDate;
        }

        public String getCompletedDate() {
            return completedDate;
        }

        public void setCompletedDate(String completedDate) {
            this.completedDate = completedDate;
        }

        public Boolean getIsCompleted() {
            return isCompleted;
        }

        public void setIsCompleted(Boolean isCompleted) {
            this.isCompleted = isCompleted;
        }
    }

    class AchievementDetailRow {
        private String id;
        private String title;
        private String type;
        private String description;
        private String achievementDate;
        private String citationReason;
        private String ownerPersons;
        private String coBuilders;
        private String secondaryColleges;
        private String status;
        private int viewCount;
        private Boolean isPublic;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getAchievementDate() {
            return achievementDate;
        }

        public void setAchievementDate(String achievementDate) {
            this.achievementDate = achievementDate;
        }

        public String getCitationReason() {
            return citationReason;
        }

        public void setCitationReason(String citationReason) {
            this.citationReason = citationReason;
        }

        public String getOwnerPersons() {
            return ownerPersons;
        }

        public void setOwnerPersons(String ownerPersons) {
            this.ownerPersons = ownerPersons;
        }

        public String getCoBuilders() {
            return coBuilders;
        }

        public void setCoBuilders(String coBuilders) {
            this.coBuilders = coBuilders;
        }

        public String getSecondaryColleges() {
            return secondaryColleges;
        }

        public void setSecondaryColleges(String secondaryColleges) {
            this.secondaryColleges = secondaryColleges;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public int getViewCount() {
            return viewCount;
        }

        public void setViewCount(int viewCount) {
            this.viewCount = viewCount;
        }

        public Boolean getIsPublic() {
            return isPublic;
        }

        public void setIsPublic(Boolean isPublic) {
            this.isPublic = isPublic;
        }

        public OffsetDateTime getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
        }

        public OffsetDateTime getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(OffsetDateTime updatedAt) {
            this.updatedAt = updatedAt;
        }
    }

    class AgreementDetailRow {
        private String id;
        private String name;
        private String type;
        private String content;
        private String startDate;
        private String endDate;
        private String status;
        private Boolean isPublic;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;

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

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }

        public String getStartDate() {
            return startDate;
        }

        public void setStartDate(String startDate) {
            this.startDate = startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public void setEndDate(String endDate) {
            this.endDate = endDate;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public Boolean getIsPublic() {
            return isPublic;
        }

        public void setIsPublic(Boolean isPublic) {
            this.isPublic = isPublic;
        }

        public OffsetDateTime getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
        }

        public OffsetDateTime getUpdatedAt() {
            return updatedAt;
        }

        public void setUpdatedAt(OffsetDateTime updatedAt) {
            this.updatedAt = updatedAt;
        }
    }

    class NewMonthCountRow {
        private String month;
        private int experts;
        private int positions;
        private int scenarios;

        public String getMonth() {
            return month;
        }

        public void setMonth(String month) {
            this.month = month;
        }

        public int getExperts() {
            return experts;
        }

        public void setExperts(int experts) {
            this.experts = experts;
        }

        public int getPositions() {
            return positions;
        }

        public void setPositions(int positions) {
            this.positions = positions;
        }

        public int getScenarios() {
            return scenarios;
        }

        public void setScenarios(int scenarios) {
            this.scenarios = scenarios;
        }
    }

    class ContentMonthCountRow {
        private String month;
        private int projects;
        private int agreements;
        private int achievements;

        public String getMonth() {
            return month;
        }

        public void setMonth(String month) {
            this.month = month;
        }

        public int getProjects() {
            return projects;
        }

        public void setProjects(int projects) {
            this.projects = projects;
        }

        public int getAgreements() {
            return agreements;
        }

        public void setAgreements(int agreements) {
            this.agreements = agreements;
        }

        public int getAchievements() {
            return achievements;
        }

        public void setAchievements(int achievements) {
            this.achievements = achievements;
        }
    }

    class CoBuilderRow {
        private String id;
        private String name;
        private String title;
        private String expertId;
        private String enterpriseName;
        private String userId;

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

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getExpertId() {
            return expertId;
        }

        public void setExpertId(String expertId) {
            this.expertId = expertId;
        }

        public String getEnterpriseName() {
            return enterpriseName;
        }

        public void setEnterpriseName(String enterpriseName) {
            this.enterpriseName = enterpriseName;
        }

        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }
    }
}
