package org.dromara.zhiyu.mapper.affairs;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.affairs.TrainingProgramCourse;

import java.util.List;

/**
 * 人培方案课程 Mapper（training_program_courses 表）。
 *
 * @author zhiyu
 */
public interface TrainingProgramCourseMapper extends BaseMapperPlus<TrainingProgramCourse, TrainingProgramCourse> {

    /** 全量删除方案课程（保存时整体替换）。 */
    @Delete("DELETE FROM training_program_courses WHERE program_id = #{programId}")
    int deleteByProgram(@Param("programId") String programId);

    /** 按方案 ID 批量统计课程数（组装列表用，避免 N+1）。 */
    @Select("""
        <script>
        SELECT program_id AS programId, COUNT(*) AS cnt
        FROM training_program_courses
        WHERE program_id IN
        <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
        GROUP BY program_id
        </script>
        """)
    List<ProgramCourseCount> countByProgramIds(@Param("ids") List<String> ids);

    /** 课程数统计行。 */
    record ProgramCourseCount(String programId, long cnt) {
    }
}
