package org.dromara.zhiyu.mapper.importexport;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * 导入导出 Mapper（import/export/templates 端点数据访问）。
 *
 * <p>全部 SQL 显式携带 {@code tenant_id} 过滤（租户安全红线）；导入路径按租户 + 业务键
 * 查重。表名均为字面量（无动态表名拼接），杜绝 SQL 注入面。</p>
 *
 * @author zhiyu
 */
public interface ImportExportMapper {

    // ==================== 通用按表+名称查 ID（白名单表） ====================

    @Select("SELECT id FROM industries WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectIndustryIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM majors WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectMajorIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM organizations WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectOrgIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM partner_enterprises WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectEnterpriseIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    // ==================== 品牌深链查询（对齐 Go store/alliance_brand_import.go） ====================

    @Select("SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id"
        + " WHERE u.tenant_id = #{tenantId} AND u.name = #{name} AND r.code = #{roleCode} LIMIT 1")
    String selectUserIdByNameWithRole(@Param("tenantId") String tenantId, @Param("name") String name,
                                      @Param("roleCode") String roleCode);

    @Select("SELECT id FROM career_positions WHERE tenant_id = #{tenantId} AND name = #{name}"
        + " AND position_type = 'teaching' LIMIT 1")
    String selectTeachingPositionIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM alliance_brands WHERE tenant_id = #{tenantId} AND brand_type = 'job'"
        + " AND name = #{name} LIMIT 1")
    String selectJobBrandIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM alliance_brands WHERE tenant_id = #{tenantId} AND brand_type = 'employer'"
        + " AND enterprise_id IS NULL AND name = #{name} LIMIT 1")
    String selectIndependentEmployerBrandIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM alliance_achievements WHERE tenant_id = #{tenantId} AND title = #{title} LIMIT 1")
    String selectAchievementIdByTitle(@Param("tenantId") String tenantId, @Param("title") String title);

    @Select("SELECT id FROM courses WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectCourseIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM alliance_experts WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectExpertIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM alliance_projects WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectProjectIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM org_types WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectOrgTypeIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    // ==================== 行业 industries ====================

    @Select("SELECT id FROM industries WHERE tenant_id = #{tenantId} AND code = #{code} LIMIT 1")
    String selectIndustryIdByCode(@Param("tenantId") String tenantId, @Param("code") String code);

    @Insert("INSERT INTO industries (id, tenant_id, code, name, parent_id, sort_order, enabled)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, #{parentId}, #{sortOrder}, #{enabled})")
    int insertIndustry(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                       @Param("name") String name, @Param("parentId") String parentId,
                       @Param("sortOrder") Integer sortOrder, @Param("enabled") boolean enabled);

    @Update("UPDATE industries SET name = #{name}, parent_id = #{parentId},"
        + " sort_order = #{sortOrder}, enabled = #{enabled}, updated_at = NOW()"
        + " WHERE tenant_id = #{tenantId} AND code = #{code}")
    int updateIndustryByCode(@Param("tenantId") String tenantId, @Param("code") String code,
                             @Param("name") String name, @Param("parentId") String parentId,
                             @Param("sortOrder") Integer sortOrder, @Param("enabled") boolean enabled);

    // ==================== 专业 majors ====================

    @Select("SELECT id FROM majors WHERE tenant_id = #{tenantId} AND code = #{code} LIMIT 1")
    String selectMajorIdByCode(@Param("tenantId") String tenantId, @Param("code") String code);

    @Insert("INSERT INTO majors (id, tenant_id, code, name, alias, enabled)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, #{alias}, #{enabled})")
    int insertMajor(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                    @Param("name") String name, @Param("alias") String alias, @Param("enabled") boolean enabled);

    @Update("UPDATE majors SET name = #{name}, alias = #{alias}, enabled = #{enabled}, updated_at = NOW()"
        + " WHERE tenant_id = #{tenantId} AND code = #{code}")
    int updateMajorByCode(@Param("tenantId") String tenantId, @Param("code") String code,
                          @Param("name") String name, @Param("alias") String alias, @Param("enabled") boolean enabled);

    // ==================== 组织 organizations ====================

    @Select("SELECT o.id FROM organizations o WHERE o.tenant_id = #{tenantId} AND o.name = #{name}"
        + " AND o.type_id = (SELECT id FROM org_types WHERE tenant_id = #{tenantId} AND name = #{typeName} LIMIT 1) LIMIT 1")
    String selectOrgIdByNameType(@Param("tenantId") String tenantId, @Param("name") String name,
                                 @Param("typeName") String typeName);

    @Insert("INSERT INTO organizations (id, tenant_id, name, type_id, parent_id, sort_order, member_count)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{typeId}, #{parentId}, #{sortOrder}, 0)")
    int insertOrganization(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                           @Param("typeId") String typeId, @Param("parentId") String parentId,
                           @Param("sortOrder") Integer sortOrder);

    @Update("UPDATE organizations SET parent_id = #{parentId}, sort_order = #{sortOrder}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateOrganizationParent(@Param("id") String id, @Param("tenantId") String tenantId,
                                 @Param("parentId") String parentId, @Param("sortOrder") Integer sortOrder);

    // ==================== 用户 users（学生/教师） ====================

    @Select("SELECT id FROM users WHERE tenant_id = #{tenantId} AND login_name = #{loginName} LIMIT 1")
    String selectUserIdByLoginName(@Param("tenantId") String tenantId, @Param("loginName") String loginName);

    @Insert("INSERT INTO users (id, tenant_id, org_node_id, role, login_name, username, password_hash, name, status, platform)"
        + " VALUES (#{id}, #{tenantId}, #{orgNodeId}, 'school', #{loginName}, #{username},"
        + " #{passwordHash}, #{name}, #{status}, 'portal')")
    int insertUser(@Param("id") String id, @Param("tenantId") String tenantId, @Param("orgNodeId") String orgNodeId,
                   @Param("loginName") String loginName, @Param("username") String username,
                   @Param("passwordHash") String passwordHash, @Param("name") String name, @Param("status") String status);

    // ==================== 联盟 alliance_* ====================

    @Insert("INSERT INTO alliance_projects (id, tenant_id, name, type, phase, budget, start_date, end_date,"
        + " description, enterprise_ids, secondary_colleges, is_public, created_by)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{type}, #{phase}, #{budget}, #{startDate}, #{endDate},"
        + " #{description}, #{enterpriseIds}, #{secondaryColleges}, #{isPublic}, #{createdBy})")
    int insertAllianceProject(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                              @Param("type") String type, @Param("phase") String phase, @Param("budget") String budget,
                              @Param("startDate") java.time.LocalDate startDate,
                              @Param("endDate") java.time.LocalDate endDate, @Param("description") String description,
                              @Param("enterpriseIds") String enterpriseIds,
                              @Param("secondaryColleges") String secondaryColleges, @Param("isPublic") boolean isPublic,
                              @Param("createdBy") String createdBy);

    @Insert("INSERT INTO alliance_achievements (id, tenant_id, title, type, achievement_date, description,"
        + " project_ids, enterprise_ids, secondary_colleges, is_public, created_by)"
        + " VALUES (#{id}, #{tenantId}, #{title}, #{type}, #{achievementDate}, #{description},"
        + " #{projectIds}, #{enterpriseIds}, #{secondaryColleges}, #{isPublic}, #{createdBy})")
    int insertAllianceAchievement(@Param("id") String id, @Param("tenantId") String tenantId, @Param("title") String title,
                                  @Param("type") String type, @Param("achievementDate") java.time.LocalDate achievementDate,
                                  @Param("description") String description, @Param("projectIds") String projectIds,
                                  @Param("enterpriseIds") String enterpriseIds,
                                  @Param("secondaryColleges") String secondaryColleges, @Param("isPublic") boolean isPublic,
                                  @Param("createdBy") String createdBy);

    @Insert("INSERT INTO alliance_agreements (id, tenant_id, name, type, status, start_date, end_date, content,"
        + " enterprise_ids, project_ids, created_by)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{type}, #{status}, #{startDate}, #{endDate}, #{content},"
        + " #{enterpriseIds}, #{projectIds}, #{createdBy})")
    int insertAllianceAgreement(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                                @Param("type") String type, @Param("status") String status,
                                @Param("startDate") java.time.LocalDate startDate,
                                @Param("endDate") java.time.LocalDate endDate, @Param("content") String content,
                                @Param("enterpriseIds") String enterpriseIds, @Param("projectIds") String projectIds,
                                @Param("createdBy") String createdBy);

    @Insert("INSERT INTO alliance_permissions (id, tenant_id, account_name, account_type, is_enabled)"
        + " VALUES (#{id}, #{tenantId}, #{accountName}, #{accountType}, #{isEnabled})")
    int insertAlliancePermission(@Param("id") String id, @Param("tenantId") String tenantId,
                                 @Param("accountName") String accountName, @Param("accountType") String accountType,
                                 @Param("isEnabled") boolean isEnabled);

    @Insert("INSERT INTO alliance_brands (id, tenant_id, brand_type, name, status, is_public, is_featured,"
        + " cover_image, description, student_id, enterprise_id, position_id, major_id, teacher_id, expert_id)"
        + " VALUES (#{id}, #{tenantId}, #{brandType}, #{name}, #{status}, #{isPublic}, #{isFeatured},"
        + " #{coverImage}, #{description}, #{studentId}, #{enterpriseId}, #{positionId},"
        + " #{majorId}, #{teacherId}, #{expertId})")
    int insertAllianceBrand(@Param("id") String id, @Param("tenantId") String tenantId,
                            @Param("brandType") String brandType, @Param("name") String name,
                            @Param("status") String status, @Param("isPublic") boolean isPublic,
                            @Param("isFeatured") boolean isFeatured, @Param("coverImage") String coverImage,
                            @Param("description") String description, @Param("studentId") String studentId,
                            @Param("enterpriseId") String enterpriseId, @Param("positionId") String positionId,
                            @Param("majorId") String majorId, @Param("teacherId") String teacherId,
                            @Param("expertId") String expertId);

    // ==================== 通用 CSV 实体（import_export_handler） ====================

    @Select("SELECT id FROM question_banks WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectQuestionBankIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO question_banks (id, tenant_id, name, description, status, question_count, creator_id, version, owner_type, is_draft_pool, code)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{description}, 'draft', 0, #{creatorId}, 'V1.0', 'tenant', FALSE, #{code})")
    int insertQuestionBank(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                           @Param("description") String description, @Param("creatorId") String creatorId,
                           @Param("code") String code);

    @Update("UPDATE question_banks SET name = #{name}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateQuestionBankName(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM exams WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectExamIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO exams (id, tenant_id, name, description, status, total_score, duration, creator_id, version, owner_type, code)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{description}, 'draft', 0, 60, #{creatorId}, 'V1.0', 'tenant', #{code})")
    int insertExam(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                   @Param("description") String description, @Param("creatorId") String creatorId,
                   @Param("code") String code);

    @Update("UPDATE exams SET name = #{name}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateExamName(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM courses WHERE tenant_id = #{tenantId} AND code = #{code} LIMIT 1")
    String selectCourseIdByCode(@Param("tenantId") String tenantId, @Param("code") String code);

    @Insert("INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id, co_creator_ids, node_count, resource_count, study_count)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, 'system', '导入', 'draft', #{creatorId}, '{}', 0, 0, 0)")
    int insertCourse(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                     @Param("name") String name, @Param("creatorId") String creatorId);

    @Update("UPDATE courses SET name = #{name}, code = #{code}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateCourseName(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name, @Param("code") String code);

    @Select("SELECT id FROM career_positions WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectCareerPositionIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO career_positions (id, tenant_id, name, short_name, position_type, status, created_by)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{shortName}, 'other', 'draft', #{createdBy})")
    int insertCareerPosition(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                             @Param("shortName") String shortName, @Param("createdBy") String createdBy);

    @Update("UPDATE career_positions SET name = #{name}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateCareerPositionName(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id FROM scenarios WHERE tenant_id = #{tenantId} AND name = #{name} LIMIT 1")
    String selectScenarioIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    /** 方案课程导入：按租户+名称查体系课 id+name（对齐 Go CourseImportFindSystemCourseIDAndName）。 */
    @Select("SELECT id AS id, name FROM courses WHERE name = #{name} AND type = 'system'"
        + " AND tenant_id = #{tenantId} LIMIT 1")
    Map<String, Object> selectSystemCourseIdAndName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO scenarios (id, tenant_id, name, code, status, created_by, collaborators, version)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{code}, 'draft', #{createdBy}, '{}', 'V1.0')")
    int insertScenario(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                       @Param("code") String code, @Param("createdBy") String createdBy);

    @Update("UPDATE scenarios SET name = #{name}, code = #{code}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateScenarioName(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name, @Param("code") String code);

    // ==================== 导出数据查询（列表填充） ====================

    @Select("<script>SELECT code, name FROM industries WHERE tenant_id = #{tenantId}"
        + " <if test=\"ids != null and ids.size() > 0\">AND id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY sort_order, code</script>")
    List<Map<String, Object>> listIndustries(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    @Select("<script>SELECT code, name, alias FROM majors WHERE tenant_id = #{tenantId}"
        + " <if test=\"ids != null and ids.size() > 0\">AND id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY code</script>")
    List<Map<String, Object>> listMajors(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    @Select("<script>SELECT o.name, ot.name AS type_name, p.name AS parent_name FROM organizations o"
        + " LEFT JOIN org_types ot ON ot.id = o.type_id LEFT JOIN organizations p ON p.id = o.parent_id"
        + " WHERE o.tenant_id = #{tenantId}"
        + " <if test=\"ids != null and ids.size() > 0\">AND o.id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY o.name</script>")
    List<Map<String, Object>> listOrganizations(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    @Select("<script>SELECT login_name, name, student_no, work_id, status FROM users WHERE tenant_id = #{tenantId}"
        + " <if test=\"ids != null and ids.size() > 0\">AND id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY name</script>")
    List<Map<String, Object>> listUsers(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    @Select("<script>SELECT name, description, status FROM question_banks WHERE tenant_id = #{tenantId}"
        + " <if test=\"ids != null and ids.size() > 0\">AND id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY name</script>")
    List<Map<String, Object>> listQuestionBanks(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    @Select("<script>SELECT name, description, status FROM exams WHERE tenant_id = #{tenantId}"
        + " <if test=\"ids != null and ids.size() > 0\">AND id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY name</script>")
    List<Map<String, Object>> listExams(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    // ==================== 模板字典参考数据 ====================

    @Select("SELECT name FROM org_types WHERE tenant_id = #{tenantId} ORDER BY name")
    List<String> listOrgTypeNames(@Param("tenantId") String tenantId);

    @Select("SELECT name FROM staff_titles WHERE tenant_id = #{tenantId} ORDER BY name")
    List<String> listStaffTitleNames(@Param("tenantId") String tenantId);

    @Select("SELECT name FROM knowledge_points WHERE tenant_id = #{tenantId} ORDER BY name")
    List<String> listKnowledgePointNames(@Param("tenantId") String tenantId);

    @Select("SELECT name FROM ability_points WHERE tenant_id = #{tenantId} ORDER BY name")
    List<String> listAbilityPointNames(@Param("tenantId") String tenantId);

    @Select("SELECT name FROM resource_library WHERE tenant_id = #{tenantId} ORDER BY name")
    List<String> listResourceNames(@Param("tenantId") String tenantId);

    @Select("SELECT name FROM career_positions WHERE tenant_id = #{tenantId} AND status = 'published' ORDER BY name")
    List<String> listPublishedPositionNames(@Param("tenantId") String tenantId);

    @Select("SELECT DISTINCT batch_name FROM ("
        + " SELECT name AS batch_name FROM lesson_batches WHERE tenant_id = #{tenantId}"
        + " UNION SELECT name AS batch_name FROM evaluation_batches WHERE tenant_id = #{tenantId}"
        + ") b ORDER BY batch_name")
    List<String> listBatchNames(@Param("tenantId") String tenantId);

    @Select("<script>SELECT cp.id AS id, cp.name, COALESCE(cp.short_name,'') AS short_name, cp.position_type AS position_type,"
        + " cp.salary_min, cp.salary_max, COALESCE(cp.description, '') AS description,"
        + " COALESCE(cp.career_path, '') AS career_path, cp.industry_id AS industry_id,"
        + " cp.batch_id AS batch_id, cp.requirements AS requirements"
        + " FROM career_positions cp WHERE cp.tenant_id = #{tenantId}"
        + " <if test=\"ids != null and ids.size() > 0\">AND cp.id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY cp.name</script>")
    List<Map<String, Object>> listPositionsForExport(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    @Select("SELECT name FROM industries WHERE id = #{id} AND tenant_id = #{tenantId}")
    String selectIndustryNameById(@Param("tenantId") String tenantId, @Param("id") String id);

    @Select("SELECT name FROM batches WHERE id = #{id} AND tenant_id = #{tenantId}")
    String selectBatchNameById(@Param("tenantId") String tenantId, @Param("id") String id);

    @Select("SELECT m.name FROM majors m JOIN career_position_majors cpm ON cpm.major_id = m.id"
        + " JOIN career_positions cp ON cp.id = cpm.career_position_id"
        + " WHERE cpm.career_position_id = #{positionId} AND cp.tenant_id = #{tenantId}")
    List<String> listPositionMajorNames(@Param("tenantId") String tenantId, @Param("positionId") String positionId);

    @Select("SELECT cl.name FROM certificate_library cl JOIN position_certificates pc ON pc.certificate_library_id = cl.id"
        + " WHERE pc.career_position_id = #{positionId} AND pc.tenant_id = #{tenantId}")
    List<String> listPositionCertNames(@Param("tenantId") String tenantId, @Param("positionId") String positionId);

    @Select("SELECT pr.name AS responsibility_name, ap.name AS ability_name,"
        + " ap.attributes AS ability_attributes, pab.attributes AS binding_attributes,"
        + " COALESCE(pab.domain, '') AS domain, pab.required_level, COALESCE(pab.rubric_description, '') AS rubric_description"
        + " FROM position_ability_bindings pab"
        + " JOIN position_responsibilities pr ON pr.id = pab.responsibility_id"
        + " JOIN ability_points ap ON ap.id = pab.ability_point_id"
        + " WHERE pab.career_position_id = #{positionId} AND pab.tenant_id = #{tenantId}"
        + " ORDER BY pr.sort_order")
    List<Map<String, Object>> listPositionAbilityBindings(@Param("tenantId") String tenantId,
                                                           @Param("positionId") String positionId);

    @Select("<script>SELECT s.name, s.difficulty, COALESCE(s.background, '') AS background, s.code"
        + " FROM scenarios s WHERE s.tenant_id = #{tenantId}"
        + " <if test=\"ids != null and ids.size() > 0\">AND s.id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY s.name</script>")
    List<Map<String, Object>> listScenariosForExport(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    @Select("<script>SELECT c.id AS id, c.name, COALESCE(c.description, '') AS description,"
        + " c.major_id AS major_id, c.batch_id AS batch_id, c.type AS type, c.code"
        + " FROM courses c WHERE c.tenant_id = #{tenantId} AND c.type = 'system'"
        + " <if test=\"ids != null and ids.size() > 0\">AND c.id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY c.name</script>")
    List<Map<String, Object>> listSystemCoursesForExport(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    @Select("SELECT name FROM majors WHERE id = #{id} AND tenant_id = #{tenantId}")
    String selectMajorNameById(@Param("tenantId") String tenantId, @Param("id") String id);

    @Select("SELECT name FROM lesson_batches WHERE id = #{id} AND tenant_id = #{tenantId}")
    String selectLessonBatchNameById(@Param("tenantId") String tenantId, @Param("id") String id);

    @Select("<script>SELECT c.id AS id, c.name, COALESCE(c.description, '') AS description, c.difficulty,"
        + " c.online_hours, c.major_id AS major_id, c.batch_id AS batch_id"
        + " FROM courses c WHERE c.tenant_id = #{tenantId} AND c.type = 'granular'"
        + " <if test=\"ids != null and ids.size() > 0\">AND c.id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY c.name</script>")
    List<Map<String, Object>> listGranularCoursesForExport(@Param("tenantId") String tenantId, @Param("ids") List<String> ids);

    @Select("<script>SELECT q.type AS type, q.content, q.score"
        + " FROM questions q WHERE q.tenant_id = #{tenantId} AND q.question_bank_id = #{bankId}"
        + " <if test=\"ids != null and ids.size() > 0\">AND q.id IN <foreach collection=\"ids\" item=\"i\" open=\"(\" separator=\",\" close=\")\">#{i}</foreach></if>"
        + " ORDER BY q.created_at</script>")
    List<Map<String, Object>> listQuestionsForExport(@Param("tenantId") String tenantId, @Param("bankId") String bankId,
                                                     @Param("ids") List<String> ids);

    /**
     * 通用 CSV 导出数据行（entity 为 service 白名单校验后的表名，SQL 用 choose 分支拼固定表名）。
     */
    @Select("<script>SELECT id AS id, name, COALESCE(code, '') AS code, COALESCE(description, '') AS description,"
        + " status AS status, created_at FROM ("
        + "<choose>"
        + "<when test=\"entity == 'question_banks'\">SELECT id, name, NULL AS code, description, status, created_at FROM question_banks WHERE tenant_id = #{tenantId}</when>"
        + "<when test=\"entity == 'exams'\">SELECT id, name, NULL AS code, description, status, created_at FROM exams WHERE tenant_id = #{tenantId}</when>"
        + "<when test=\"entity == 'courses'\">SELECT id, name, code, NULL AS description, status, created_at FROM courses WHERE tenant_id = #{tenantId}</when>"
        + "<when test=\"entity == 'career_positions'\">SELECT id, name, NULL AS code, NULL AS description, status, created_at FROM career_positions WHERE tenant_id = #{tenantId}</when>"
        + "<when test=\"entity == 'scenarios'\">SELECT id, name, code, NULL AS description, status, created_at FROM scenarios WHERE tenant_id = #{tenantId}</when>"
        + "<otherwise>SELECT NULL AS id, '' AS name, '' AS code, '' AS description, '' AS status, CAST(NULL AS DATETIME) AS created_at WHERE FALSE</otherwise>"
        + "</choose>"
        + ") t ORDER BY created_at DESC</script>")
    List<Map<String, Object>> listGenericExportRows(@Param("entity") String entity, @Param("tenantId") String tenantId);
}
