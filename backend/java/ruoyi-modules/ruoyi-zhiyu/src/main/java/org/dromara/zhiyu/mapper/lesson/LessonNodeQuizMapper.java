package org.dromara.zhiyu.mapper.lesson;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.lesson.LessonNodeQuiz;

import java.util.List;

/**
 * 节点测验 Mapper（node_quizzes 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface LessonNodeQuizMapper extends BaseMapperPlus<LessonNodeQuiz, LessonNodeQuiz> {

    /** 测验列表（按 nodeId 过滤，租户隔离，无分页，对齐 Go ListQuizzes）。 */
    @Select("<script>SELECT id, node_id, title, type, time_limit, tenant_id FROM node_quizzes"
        + " WHERE tenant_id = #{tenantId}"
        + " <if test=\"nodeId != null and nodeId != ''\">AND node_id = #{nodeId}</if>"
        + " ORDER BY id DESC</script>")
    List<LessonNodeQuiz> selectQuizzes(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId);

    /** 查询单个测验（限定租户）。 */
    @Select("SELECT id, node_id, title, type, time_limit, tenant_id FROM node_quizzes"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    LessonNodeQuiz selectQuiz(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 创建测验，返回 id。 */
    @Insert("INSERT INTO node_quizzes (id, tenant_id, node_id, title, type, time_limit)"
        + " VALUES ((UUID()), #{tenantId}, #{nodeId}, #{title}, #{type}, #{timeLimit})"
        + " RETURNING id")
    String insertQuiz(@Param("tenantId") String tenantId, @Param("nodeId") String nodeId,
                      @Param("title") String title, @Param("type") String type, @Param("timeLimit") Integer timeLimit);

    /** 更新测验（time_limit 为 null 时保留原值，限定租户）。 */
    @Update("UPDATE node_quizzes SET title = #{title}, type = #{type},"
        + " time_limit = COALESCE(#{timeLimit}, time_limit)"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateQuiz(@Param("id") String id, @Param("tenantId") String tenantId,
                   @Param("title") String title, @Param("type") String type, @Param("timeLimit") Integer timeLimit);

    /** 删除测验（限定租户）。 */
    @Delete("DELETE FROM node_quizzes WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteQuiz(@Param("id") String id, @Param("tenantId") String tenantId);
}
