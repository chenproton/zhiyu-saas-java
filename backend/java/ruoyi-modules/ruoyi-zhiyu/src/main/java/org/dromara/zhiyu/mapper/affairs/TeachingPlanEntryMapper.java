package org.dromara.zhiyu.mapper.affairs;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.domain.affairs.TeachingPlanEntry;

import java.math.BigDecimal;
import java.util.List;

/**
 * 教学计划条目 Mapper（teaching_plan_entries 表，含关联名称与多班级 junction）。
 *
 * @author zhiyu
 */
public interface TeachingPlanEntryMapper extends BaseMapperPlus<TeachingPlanEntry, TeachingPlanEntry> {

    String ENTRY_SELECT = """
        SELECT e.id, e.plan_id, e.course_name, COALESCE(NULLIF(e.course_code, ''), c.code) AS course_code,
            e.type, e.nature, e.credits, e.total_hours, e.week_hours, e.start_week, e.end_week, e.week_pattern,
            e.class_node_id, COALESCE(o.name, '') AS class_name, e.teacher_id, COALESCE(u.name, '') AS teacher_name,
            e.teacher_type, e.venue_type, e.scenario_id, COALESCE(s.name, '') AS scenario_name,
            COALESCE(cp.name, '') AS position_name, e.course_id, COALESCE(c.name, '') AS linked_course_name, e.status,
            COALESCE((SELECT JSON_ARRAYAGG(ec.class_node_id) FROM teaching_plan_entry_classes ec WHERE ec.entry_id = e.id), JSON_ARRAY()) AS class_node_ids,
            COALESCE((SELECT JSON_ARRAYAGG(o2.name ORDER BY ec.class_node_id) FROM teaching_plan_entry_classes ec JOIN organizations o2 ON o2.id = ec.class_node_id WHERE ec.entry_id = e.id), JSON_ARRAY()) AS class_names
        FROM teaching_plan_entries e
        JOIN teaching_plans p ON p.id = e.plan_id
        LEFT JOIN organizations o ON o.id = e.class_node_id
        LEFT JOIN users u ON u.id = e.teacher_id
        LEFT JOIN scenarios s ON s.id = e.scenario_id
        LEFT JOIN career_positions cp ON cp.id = s.career_position_id
        LEFT JOIN courses c ON c.id = e.course_id
        """;

    String ENTRY_RESULTS = "teachingPlanEntryResultMap";

    /** 计划条目列表（含关联名称与多班级）。 */
    @Select(ENTRY_SELECT + " WHERE e.plan_id = #{planId} AND p.tenant_id = #{tenantId} ORDER BY e.start_week, e.course_name, e.id")
    @Results(id = ENTRY_RESULTS, value = {
        @Result(column = "id", property = "id"),
        @Result(column = "plan_id", property = "planId"),
        @Result(column = "course_name", property = "courseName"),
        @Result(column = "course_code", property = "courseCode"),
        @Result(column = "type", property = "type"),
        @Result(column = "nature", property = "nature"),
        @Result(column = "credits", property = "credits"),
        @Result(column = "total_hours", property = "totalHours"),
        @Result(column = "week_hours", property = "weekHours"),
        @Result(column = "start_week", property = "startWeek"),
        @Result(column = "end_week", property = "endWeek"),
        @Result(column = "week_pattern", property = "weekPattern"),
        @Result(column = "class_node_id", property = "classNodeId"),
        @Result(column = "class_name", property = "className"),
        @Result(column = "teacher_id", property = "teacherId"),
        @Result(column = "teacher_name", property = "teacherName"),
        @Result(column = "teacher_type", property = "teacherType"),
        @Result(column = "venue_type", property = "venueType"),
        @Result(column = "scenario_id", property = "scenarioId"),
        @Result(column = "scenario_name", property = "scenarioName"),
        @Result(column = "position_name", property = "positionName"),
        @Result(column = "course_id", property = "courseId"),
        @Result(column = "linked_course_name", property = "linkedCourseName"),
        @Result(column = "status", property = "status"),
        @Result(column = "class_node_ids", property = "classNodeIds", typeHandler = PgArrayTypeHandler.class),
        @Result(column = "class_names", property = "classNames", typeHandler = PgArrayTypeHandler.class),
    })
    List<TeachingPlanEntry> selectEntriesByPlan(@Param("planId") String planId, @Param("tenantId") String tenantId);

    /** 单条条目（course_code 不回退体系课 code，对齐 Go GetPlanEntry）。 */
    @Select("""
        SELECT e.id, e.plan_id, e.course_name, e.course_code, e.type, e.nature, e.credits, e.total_hours,
            e.week_hours, e.start_week, e.end_week, e.week_pattern,
            e.class_node_id, COALESCE(o.name, '') AS class_name, e.teacher_id, COALESCE(u.name, '') AS teacher_name,
            e.teacher_type, e.venue_type, e.scenario_id, COALESCE(s.name, '') AS scenario_name,
            COALESCE(cp.name, '') AS position_name, e.course_id, COALESCE(c.name, '') AS linked_course_name, e.status,
            COALESCE((SELECT JSON_ARRAYAGG(ec.class_node_id) FROM teaching_plan_entry_classes ec WHERE ec.entry_id = e.id), JSON_ARRAY()) AS class_node_ids,
            COALESCE((SELECT JSON_ARRAYAGG(o2.name ORDER BY ec.class_node_id) FROM teaching_plan_entry_classes ec JOIN organizations o2 ON o2.id = ec.class_node_id WHERE ec.entry_id = e.id), JSON_ARRAY()) AS class_names
        FROM teaching_plan_entries e
        JOIN teaching_plans p ON p.id = e.plan_id
        LEFT JOIN organizations o ON o.id = e.class_node_id
        LEFT JOIN users u ON u.id = e.teacher_id
        LEFT JOIN scenarios s ON s.id = e.scenario_id
        LEFT JOIN career_positions cp ON cp.id = s.career_position_id
        LEFT JOIN courses c ON c.id = e.course_id
        WHERE e.id = #{id} AND p.tenant_id = #{tenantId}
        """)
    @ResultMap(ENTRY_RESULTS)
    TeachingPlanEntry selectEntryById(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 更新条目（租户经 plan 关联校验，credits/total_hours 空则保留原值）。 */
    @Update("""
        UPDATE teaching_plan_entries e
        SET week_hours = #{e.weekHours}, start_week = #{e.startWeek}, end_week = #{e.endWeek}, week_pattern = #{e.weekPattern},
            class_node_id = #{e.classNodeId}, teacher_id = #{e.teacherId}, teacher_type = #{e.teacherType},
            venue_type = #{e.venueType}, status = #{e.status},
            credits = COALESCE(#{credits}, credits), total_hours = COALESCE(#{totalHours}, total_hours)
        FROM teaching_plans p
        WHERE e.id = #{id} AND p.id = e.plan_id AND p.tenant_id = #{tenantId}
        """)
    int updateEntry(@Param("id") String id, @Param("tenantId") String tenantId, @Param("e") TeachingPlanEntry e,
                    @Param("credits") BigDecimal credits, @Param("totalHours") Integer totalHours);

    /** 删除条目（租户经 plan 关联校验）。 */
    @Delete("DELETE FROM teaching_plan_entries e USING teaching_plans p WHERE e.id = #{id} AND p.id = e.plan_id AND p.tenant_id = #{tenantId}")
    int deleteEntry(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 查询条目所属租户（排课归属校验用）。 */
    @Select("SELECT p.tenant_id FROM teaching_plan_entries e JOIN teaching_plans p ON p.id = e.plan_id WHERE e.id = #{id}")
    String selectEntryTenant(@Param("id") String id);

    /** 标记条目已排。 */
    @org.apache.ibatis.annotations.Update("UPDATE teaching_plan_entries SET status = 'scheduled' WHERE id = #{id}")
    int markScheduled(@Param("id") String id);

    /** 删除排课后无草稿引用时恢复为待排。 */
    @org.apache.ibatis.annotations.Update("""
        UPDATE teaching_plan_entries SET status = 'planned'
        WHERE id = #{id} AND NOT EXISTS (SELECT 1 FROM schedule_entries WHERE plan_entry_id = #{id} AND status = 'draft')
        """)
    int markPlannedIfNoDraft(@Param("id") String id);

    /** 查询条目课程 ID（排课课程覆盖）。 */
    @Select("SELECT course_id FROM teaching_plan_entries WHERE id = #{id}")
    String selectCourseId(@Param("id") String id);

    /** 查询条目班级（junction 优先，回退 class_node_id）。 */
    @Select("""
        SELECT COALESCE(
            (SELECT class_node_id FROM teaching_plan_entry_classes WHERE entry_id = #{id} LIMIT 1),
            (SELECT class_node_id FROM teaching_plan_entries WHERE id = #{id}))
        """)
    String selectFallbackClassId(@Param("id") String id);

    /** 按计划 ID 批量统计条目数（列表组装用，避免 N+1）。 */
    @Select("""
        <script>
        SELECT plan_id AS planId, COUNT(*) AS cnt
        FROM teaching_plan_entries
        WHERE plan_id IN
        <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
        GROUP BY plan_id
        </script>
        """)
    List<EntryCount> countByPlanIds(@Param("ids") List<String> ids);

    /** 条目数统计行。 */
    record EntryCount(String planId, long cnt) {
    }
}
