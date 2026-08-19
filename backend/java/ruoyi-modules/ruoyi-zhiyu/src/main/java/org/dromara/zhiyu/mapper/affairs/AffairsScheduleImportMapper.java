package org.dromara.zhiyu.mapper.affairs;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.Map;

/**
 * 排课 Excel 导入 SQL（对齐 Go store/imports.go + terms.go）。
 * 业务编排（整周矩阵解析、清空草稿重排）在 ImportExportServiceImpl.importSchedules。
 *
 * @author zhiyu
 */
public interface AffairsScheduleImportMapper {

    @Select("SELECT EXISTS(SELECT 1 FROM terms WHERE id = #{termId}::uuid AND tenant_id = #{tenantId}::uuid)")
    boolean termExists(@Param("tenantId") String tenantId, @Param("termId") String termId);

    @Select("SELECT p.term_id::text FROM teaching_plan_entries e JOIN teaching_plans p ON p.id = e.plan_id"
        + " WHERE p.tenant_id = #{tenantId}::uuid AND e.course_name = #{courseName} LIMIT 1")
    String inferTermByCourseName(@Param("tenantId") String tenantId, @Param("courseName") String courseName);

    @Select("SELECT e.id::text AS id, e.teacher_id::text AS teacher_id, e.class_node_id::text AS class_node_id,"
        + " e.scenario_id::text AS scenario_id, e.course_id::text AS course_id, e.course_code"
        + " FROM teaching_plan_entries e JOIN teaching_plans p ON p.id = e.plan_id"
        + " WHERE p.tenant_id = #{tenantId}::uuid AND p.term_id = #{termId}::uuid AND e.course_name = #{courseName} LIMIT 1")
    Map<String, Object> findPlanEntryByCourse(@Param("tenantId") String tenantId, @Param("termId") String termId,
                                              @Param("courseName") String courseName);

    @Select("SELECT id::text FROM organizations WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String findOrgIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id::text FROM users WHERE tenant_id = #{tenantId}::uuid AND (name = #{name} OR username = #{name}) LIMIT 1")
    String findTeacherIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Select("SELECT id::text FROM venues WHERE tenant_id = #{tenantId}::uuid AND name = #{name} LIMIT 1")
    String findVenueIdByName(@Param("tenantId") String tenantId, @Param("name") String name);

    @Insert("INSERT INTO schedule_entries (id, tenant_id, term_id, plan_entry_id, course_name, course_code, course_id, type,"
        + " class_node_id, class_node_ids, teacher_id, day_of_week, periods, start_week, end_week, week_pattern,"
        + " venue_id, scenario_id, source, status, version)"
        + " VALUES (#{id}, #{tenantId}::uuid, #{termId}::uuid, #{planEntryId}::uuid, #{courseName}, #{courseCode}, #{courseId}, #{entryType},"
        + " #{firstClassId}::uuid, #{classNodeIds}, #{teacherId}, #{day}, #{periods}, #{startWeek}, #{endWeek}, #{weekPattern},"
        + " #{venueId}, #{scenarioId}, 'imported', 'draft', 1)")
    int insertScheduleEntry(@Param("id") String id, @Param("tenantId") String tenantId, @Param("termId") String termId,
                            @Param("planEntryId") String planEntryId, @Param("courseName") String courseName,
                            @Param("courseCode") String courseCode, @Param("courseId") String courseId,
                            @Param("entryType") String entryType, @Param("firstClassId") String firstClassId,
                            @Param("classNodeIds") String classNodeIds, @Param("teacherId") String teacherId,
                            @Param("day") Integer day, @Param("periods") String periods,
                            @Param("startWeek") Integer startWeek, @Param("endWeek") Integer endWeek,
                            @Param("weekPattern") String weekPattern, @Param("venueId") String venueId,
                            @Param("scenarioId") String scenarioId);

    @Update("UPDATE teaching_plan_entries SET status = 'scheduled' WHERE id = #{planEntryId}::uuid")
    int markPlanEntryScheduled(@Param("planEntryId") String planEntryId);

    @Delete("DELETE FROM schedule_entries WHERE tenant_id = #{tenantId}::uuid AND term_id = #{termId}::uuid"
        + " AND status = 'draft'")
    int clearDraftScheduleEntries(@Param("tenantId") String tenantId, @Param("termId") String termId);

    @Update("UPDATE teaching_plan_entries e SET status = 'planned'"
        + " FROM teaching_plans p WHERE p.id = e.plan_id AND p.tenant_id = #{tenantId}::uuid AND p.term_id = #{termId}::uuid")
    int resetPlanEntriesToPlanned(@Param("tenantId") String tenantId, @Param("termId") String termId);
}
