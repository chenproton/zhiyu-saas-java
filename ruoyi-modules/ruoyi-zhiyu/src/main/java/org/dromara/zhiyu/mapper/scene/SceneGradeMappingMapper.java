package org.dromara.zhiyu.mapper.scene;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.scene.SceneGradeMapping;

import java.math.BigDecimal;
import java.util.List;

/**
 * 场景等级映射 Mapper（scenario_grade_mappings 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface SceneGradeMappingMapper extends BaseMapperPlus<SceneGradeMapping, SceneGradeMapping> {

    /** 等级映射列表（scenarioId/taskId 过滤，租户隔离，min_score 升序）。 */
    @Select("<script>SELECT id, scenario_id, task_id, level, min_score, max_score, description, color, tenant_id"
        + " FROM scenario_grade_mappings WHERE tenant_id = #{tenantId}"
        + " <if test=\"scenarioId != null and scenarioId != ''\">AND scenario_id = #{scenarioId}</if>"
        + " <if test=\"taskId != null and taskId != ''\">AND task_id = #{taskId}</if>"
        + " ORDER BY min_score ASC</script>")
    List<SceneGradeMapping> selectMappings(@Param("tenantId") String tenantId, @Param("scenarioId") String scenarioId,
                                           @Param("taskId") String taskId);

    /** 查询映射所属场景 ID（归属校验用）。 */
    @Select("SELECT scenario_id FROM scenario_grade_mappings WHERE id = #{id}")
    String selectScenarioId(@Param("id") String id);

    /** 插入等级映射（id 由 service 层生成）。 */
    @Insert("INSERT INTO scenario_grade_mappings (id, tenant_id, scenario_id, task_id, level, min_score, max_score,"
        + " description, color)"
        + " VALUES (#{id}, #{tenantId}, #{scenarioId}, #{taskId}, #{level},"
        + " #{minScore}, #{maxScore}, #{description}, #{color})")
    int insertMapping(@Param("id") String id, @Param("tenantId") String tenantId,
                      @Param("scenarioId") String scenarioId,
                      @Param("taskId") String taskId, @Param("level") String level,
                      @Param("minScore") BigDecimal minScore, @Param("maxScore") BigDecimal maxScore,
                      @Param("description") String description, @Param("color") String color);

    /** 更新等级映射（按 id）。 */
    @Update("UPDATE scenario_grade_mappings SET scenario_id = #{scenarioId}, task_id = #{taskId},"
        + " level = #{level}, min_score = #{minScore}, max_score = #{maxScore}, description = #{description},"
        + " color = #{color} WHERE id = #{id}")
    int updateMapping(@Param("id") String id, @Param("scenarioId") String scenarioId, @Param("taskId") String taskId,
                      @Param("level") String level, @Param("minScore") BigDecimal minScore,
                      @Param("maxScore") BigDecimal maxScore, @Param("description") String description,
                      @Param("color") String color);

    /** 删除等级映射（限定租户，纵深防御）。 */
    @Delete("DELETE FROM scenario_grade_mappings WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteMapping(@Param("id") String id, @Param("tenantId") String tenantId);
}
