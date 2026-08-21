package org.dromara.zhiyu.mapper.lesson;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.lesson.LessonBehaviorRecord;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 课堂行为记录 Mapper（lesson_behavior_records 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface LessonBehaviorRecordMapper extends BaseMapperPlus<LessonBehaviorRecord, LessonBehaviorRecord> {

    /** 行为记录列表（join 学生姓名，按租户+课程+日期范围过滤，上限 1000）。 */
    @Select("<script>SELECT r.id, r.course_id, r.student_user_id, u.name AS student_name, r.record_date,"
        + " r.attendance, r.quiz_score, r.interaction_count, r.praise_count, r.rush_correct_count,"
        + " r.rush_avg_time_sec, r.created_at, r.updated_at, r.tenant_id"
        + " FROM lesson_behavior_records r JOIN users u ON u.id = r.student_user_id"
        + " WHERE r.course_id = #{courseId} AND r.tenant_id = #{tenantId}"
        + " <if test=\"startDate != null and startDate != ''\">AND r.record_date &gt;= #{startDate}::date</if>"
        + " <if test=\"endDate != null and endDate != ''\">AND r.record_date &lt;= #{endDate}::date</if>"
        + " ORDER BY r.record_date DESC, r.created_at DESC LIMIT 1000</script>")
    List<LessonBehaviorRecord> selectRecords(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                                             @Param("startDate") String startDate, @Param("endDate") String endDate);

    /** 保存行为记录（幂等 upsert，返回影响行数）。 */
    @Insert("INSERT INTO lesson_behavior_records"
        + " (id, tenant_id, course_id, student_user_id, record_date, attendance, quiz_score,"
        + " interaction_count, praise_count, rush_correct_count, rush_avg_time_sec)"
        + " VALUES ((UUID()), #{tenantId}, #{courseId}, #{studentUserId}, #{recordDate},"
        + " #{attendance}, #{quizScore}, #{interactionCount}, #{praiseCount}, #{rushCorrectCount}, #{rushAvgTimeSec})"
        + " ON DUPLICATE KEY UPDATE attendance = VALUES(attendance), quiz_score = VALUES(quiz_score),"
        + " interaction_count = VALUES(interaction_count), praise_count = VALUES(praise_count),"
        + " rush_correct_count = VALUES(rush_correct_count), rush_avg_time_sec = VALUES(rush_avg_time_sec),"
        + " updated_at = NOW()")
    int upsertRecord(@Param("tenantId") String tenantId, @Param("courseId") String courseId,
                     @Param("studentUserId") String studentUserId, @Param("recordDate") LocalDate recordDate,
                     @Param("attendance") String attendance, @Param("quizScore") BigDecimal quizScore,
                     @Param("interactionCount") Integer interactionCount, @Param("praiseCount") Integer praiseCount,
                     @Param("rushCorrectCount") Integer rushCorrectCount, @Param("rushAvgTimeSec") Integer rushAvgTimeSec);

    /** 查询单条已保存记录（upsert 后回读，不含学生姓名）。 */
    @Select("SELECT id, course_id, student_user_id, record_date, attendance, quiz_score, interaction_count,"
        + " praise_count, rush_correct_count, rush_avg_time_sec, created_at, updated_at, tenant_id"
        + " FROM lesson_behavior_records WHERE course_id = #{courseId} AND student_user_id = #{studentUserId}"
        + " AND record_date = #{recordDate}::date LIMIT 1")
    LessonBehaviorRecord selectUpserted(@Param("courseId") String courseId, @Param("studentUserId") String studentUserId,
                                        @Param("recordDate") LocalDate recordDate);
}
