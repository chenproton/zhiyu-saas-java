package org.dromara.zhiyu.mapper.affairs;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.affairs.ScheduleEntry;

import java.util.List;

/**
 * 教务排课 Mapper（复用 ScheduleEntry 实体 + schedule_entries 表，
 * 承载 affairs 域特有的发布/锁/自动排课/导出原始 SQL）。
 *
 * @author zhiyu
 */
public interface AffairsScheduleMapper extends BaseMapperPlus<ScheduleEntry, ScheduleEntry> {

    /** 以租户+学期粒度的 advisory 事务锁串行化排课变更（随事务释放）。 */
    @Select("SELECT GET_LOCK(CONCAT('zhiyu:schedule:', #{key}), 5)")
    Long advisoryLock(@Param("key") String key);

    /** 查询已发布区当前最大版本。 */
    @Select("SELECT COALESCE(MAX(version), 0) FROM schedule_entries WHERE tenant_id = #{tenantId} AND term_id = #{termId} AND status = 'published'")
    int selectPublishedMaxVersion(@Param("tenantId") String tenantId, @Param("termId") String termId);

    /** 删除已发布区（发布时整体覆盖）。 */
    @Delete("DELETE FROM schedule_entries WHERE tenant_id = #{tenantId} AND term_id = #{termId} AND status = 'published'")
    int deletePublished(@Param("tenantId") String tenantId, @Param("termId") String termId);

    /** 从草稿复制为已发布（resource_version 固化）。 */
    @Insert("""
        INSERT INTO schedule_entries (tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
            class_node_id, class_node_ids, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
            venue_id, scenario_id, source, status, version, resource_version)
        SELECT tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,
            class_node_id, class_node_ids, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,
            venue_id, scenario_id, source, 'published', #{newVersion},
            CASE
                WHEN se.scenario_id IS NOT NULL THEN COALESCE(
                    (SELECT rs.version FROM resource_snapshots rs
                        WHERE rs.tenant_id = #{tenantId} AND rs.resource_type = 'scenarios' AND rs.resource_id = se.scenario_id
                        ORDER BY rs.created_at DESC, rs.id DESC LIMIT 1),
                    (SELECT sc.version FROM scenarios sc WHERE sc.id = se.scenario_id))
                WHEN se.course_id IS NOT NULL THEN COALESCE(
                    (SELECT rs.version FROM resource_snapshots rs
                        WHERE rs.tenant_id = #{tenantId} AND rs.resource_type = 'courses' AND rs.resource_id = se.course_id
                        ORDER BY rs.created_at DESC, rs.id DESC LIMIT 1),
                    (SELECT c.version FROM courses c WHERE c.id = se.course_id))
            END
        FROM schedule_entries se
        WHERE tenant_id = #{tenantId} AND term_id = #{termId} AND status = 'draft'
        """)
    int publishFromDraft(@Param("tenantId") String tenantId, @Param("termId") String termId,
                         @Param("newVersion") int newVersion);

    /** 课表版本号。 */
    @Select("SELECT COALESCE(MAX(version), 1) FROM schedule_entries WHERE tenant_id = #{tenantId} AND term_id = #{termId} AND status = #{status}")
    int timetableVersion(@Param("tenantId") String tenantId, @Param("termId") String termId,
                         @Param("status") String status);

    /** 待排教学计划条目（自动排课输入）。 */
    @Select("""
        <script>
        SELECT e.id, e.course_name AS courseName, COALESCE(e.course_code, '') AS courseCode, e.type AS entryType,
            e.start_week AS startWeek, e.end_week AS endWeek, COALESCE(e.week_pattern, 'all') AS weekPattern,
            COALESCE(e.class_node_id, '') AS classNodeId, COALESCE(e.teacher_id, '') AS teacherId,
            COALESCE(e.venue_type, '') AS venueType, COALESCE(e.scenario_id, '') AS scenarioId,
            COALESCE(e.course_id, '') AS courseId
        FROM teaching_plan_entries e
        JOIN teaching_plans p ON p.id = e.plan_id
        WHERE p.tenant_id = #{tenantId} AND p.term_id = #{termId} AND p.status = 'published' AND e.status = 'planned'
        <if test="planId != null and planId != ''">AND p.id = #{planId}</if>
        ORDER BY e.start_week, e.course_name
        </script>
        """)
    List<PendingPlanEntry> selectPendingPlanEntries(@Param("tenantId") String tenantId, @Param("termId") String termId,
                                                    @Param("planId") String planId);

    /** 节次名称（自动排课用）。 */
    @Select("SELECT name FROM period_slots WHERE tenant_id = #{tenantId} ORDER BY sort_order ASC")
    List<String> selectPeriodSlotNames(@Param("tenantId") String tenantId);

    /** 场地简要（自动排课/导出用）。 */
    @Select("SELECT id, name, type FROM venues WHERE tenant_id = #{tenantId} ORDER BY name")
    List<VenueBrief> selectVenueBriefs(@Param("tenantId") String tenantId);

    /** 学期内教学计划条目简要（导出主表）。 */
    @Select("""
        SELECT e.id, e.course_name AS courseName, e.type AS entryType, e.start_week AS startWeek,
            e.end_week AS endWeek, COALESCE(e.week_pattern, 'all') AS weekPattern
        FROM teaching_plan_entries e
        JOIN teaching_plans p ON p.id = e.plan_id
        WHERE p.term_id = #{termId} AND p.tenant_id = #{tenantId}
        ORDER BY e.start_week, e.course_name, e.id
        """)
    List<PlanEntryBrief> selectPlanEntryBriefs(@Param("tenantId") String tenantId, @Param("termId") String termId);

    /** 已排课导出映射（主表回填；periods 取 JSON 文本、班级名取已逗号拼接文本）。 */
    @Select("""
        SELECT se.plan_entry_id AS planEntryId, se.day_of_week AS day, se.periods AS periodsJson,
            COALESCE(u.name, '') AS teacherName, COALESCE(v.name, '') AS venueName,
            COALESCE((SELECT GROUP_CONCAT(o2.name ORDER BY ord SEPARATOR '，') FROM JSON_TABLE(se.class_node_ids, '$[*]' COLUMNS (cid CHAR(36) PATH '$', ord FOR ORDINALITY)) c JOIN organizations o2 ON o2.id = c.cid), '') AS classNamesText
        FROM schedule_entries se
        LEFT JOIN users u ON u.id = se.teacher_id
        LEFT JOIN venues v ON v.id = se.venue_id
        WHERE se.tenant_id = #{tenantId} AND se.term_id = #{termId} AND se.status = 'draft'
        """)
    List<ScheduledExportMap> selectScheduledExportMap(@Param("tenantId") String tenantId, @Param("termId") String termId);

    /** 教师名单。 */
    @Select("""
        SELECT DISTINCT u.name FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r2 ON r2.id = ur.role_id
        WHERE u.tenant_id = #{tenantId} AND u.name != '' AND u.status = 'active' AND r2.code = 'teacher'
        ORDER BY u.name
        """)
    List<String> selectTeacherNames(@Param("tenantId") String tenantId);

    /** 班级名单。 */
    @Select("""
        SELECT o.name FROM organizations o
        JOIN org_types t ON t.id = o.type_id AND t.tenant_id = o.tenant_id
        WHERE o.tenant_id = #{tenantId} AND t.name = '班级'
        ORDER BY o.name
        """)
    List<String> selectClassNames(@Param("tenantId") String tenantId);

    /** 场地名单。 */
    @Select("SELECT name FROM venues WHERE tenant_id = #{tenantId} ORDER BY name")
    List<String> selectVenueNames(@Param("tenantId") String tenantId);

    /** 待排条目行。 */
    record PendingPlanEntry(String id, String courseName, String courseCode, String entryType, int startWeek,
                            int endWeek, String weekPattern, String classNodeId, String teacherId, String venueType,
                            String scenarioId, String courseId) {
    }

    /** 场地简要行。 */
    record VenueBrief(String id, String name, String type) {
    }

    /** 计划条目简要行。 */
    record PlanEntryBrief(String id, String courseName, String entryType, int startWeek, int endWeek,
                          String weekPattern) {
    }

    /** 已排课导出映射行。 */
    record ScheduledExportMap(String planEntryId, int day, String periodsJson, String teacherName,
                              String venueName, String classNamesText) {
    }
}
