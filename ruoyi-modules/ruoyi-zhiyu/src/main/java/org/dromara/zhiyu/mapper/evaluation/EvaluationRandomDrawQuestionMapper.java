package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationRandomDrawQuestion;

import java.util.List;
import java.util.Map;

/**
 * 随机抽题 Mapper（random_draw_questions 表）。
 *
 * @author zhiyu
 */
public interface EvaluationRandomDrawQuestionMapper extends BaseMapperPlus<EvaluationRandomDrawQuestion, EvaluationRandomDrawQuestion> {

    @Insert("INSERT INTO random_draw_questions (id, tenant_id, name, description, answer, major_id)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{description}, #{answer}, #{majorId})")
    int insertQuestion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                       @Param("description") String description, @Param("answer") String answer,
                       @Param("majorId") String majorId);

    @Update("UPDATE random_draw_questions SET name = #{name}, description = #{description}, answer = #{answer},"
        + " major_id = #{majorId}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateQuestion(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                       @Param("description") String description, @Param("answer") String answer,
                       @Param("majorId") String majorId);

    /** 批量查询专业名称（key=major_id，value=name） */
    @Select("<script>SELECT id, name FROM majors WHERE id IN"
        + " <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}::uuid</foreach></script>")
    List<Map<String, Object>> selectMajorNames(@Param("ids") List<String> ids);

    @Select("SELECT EXISTS(SELECT 1 FROM random_draw_questions WHERE tenant_id = #{tenantId}::uuid AND name = #{name})")
    boolean existsName(@Param("tenantId") String tenantId, @Param("name") String name);
}
