package org.dromara.zhiyu.mapper.library;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;
import org.dromara.zhiyu.domain.library.LibraryOnSiteQuestion;

import java.util.List;

/**
 * 现场题库 Mapper（on_site_question_library 表）。
 *
 * <p>列表走自定义 SQL（tenant 过滤 + question_text/answer LIKE 搜索 + 分页），
 * 数组列经 {@link JsonStringArrayTypeHandler} 读写；插入/更新显式 cast uuid[]/text[]，
 * 对齐 Go store/on_site_question_library.go 语义。</p>
 *
 * @author zhiyu
 */
public interface LibraryOnSiteQuestionMapper extends BaseMapperPlus<LibraryOnSiteQuestion, LibraryOnSiteQuestion> {

    String SELECT_COLUMNS = "id, tenant_id, question_text, answer, question_type, score, difficulty,"
        + " knowledge_point_ids, tags, creator_id, created_at, updated_at";

    /** 搜索条件（<script> 内 <if> 片段，供分页/计数复用） */
    String SEARCH_FRAGMENT = "<where>"
        + " tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">"
        + " AND (question_text LIKE #{search} ESCAPE '\\' OR answer LIKE #{search} ESCAPE '\\')"
        + " </if>"
        + "</where>";

    /**
     * 分页查询现场题库（search 为已转义 LIKE 通配符后的 %pattern% 表达式）。
     */
    @Select("<script>SELECT " + SELECT_COLUMNS + " FROM on_site_question_library " + SEARCH_FRAGMENT
        + " ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    @Results({
        @Result(column = "knowledge_point_ids", property = "knowledgePointIds", typeHandler = JsonStringArrayTypeHandler.class),
        @Result(column = "tags", property = "tags", typeHandler = JsonStringArrayTypeHandler.class)
    })
    List<LibraryOnSiteQuestion> selectQuestionPage(@Param("tenantId") String tenantId, @Param("search") String search,
                                                   @Param("limit") int limit, @Param("offset") int offset);

    /**
     * 现场题库总数（与 {@link #selectQuestionPage} 同条件）。
     */
    @Select("<script>SELECT COUNT(*) FROM on_site_question_library " + SEARCH_FRAGMENT + "</script>")
    long countQuestionPage(@Param("tenantId") String tenantId, @Param("search") String search);

    /**
     * 新建题目（knowledge_point_ids/tags 为 null 时 Service 传空列表，对齐 Go coalesce 为空数组）。
     */
    @Insert("INSERT INTO on_site_question_library (id, tenant_id, question_text, answer, question_type, score, difficulty, knowledge_point_ids, tags, creator_id)"
        + " VALUES (#{id}, #{tenantId}, #{questionText}, #{answer}, #{questionType}, #{score}, #{difficulty},"
        + " #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{tags, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " #{creatorId})")
    int insertQuestion(@Param("id") String id, @Param("tenantId") String tenantId,
                       @Param("questionText") String questionText, @Param("answer") String answer,
                       @Param("questionType") String questionType, @Param("score") Double score,
                       @Param("difficulty") String difficulty, @Param("knowledgePointIds") List<String> knowledgePointIds,
                       @Param("tags") List<String> tags, @Param("creatorId") String creatorId);

    /**
     * 更新题目全部字段（部分更新语义由 Service 先合并再调用）。
     */
    @Update("UPDATE on_site_question_library SET"
        + " question_text = #{questionText}, answer = #{answer}, question_type = #{questionType},"
        + " score = #{score}, difficulty = #{difficulty},"
        + " knowledge_point_ids = #{knowledgePointIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " tags = #{tags, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " updated_at = NOW()"
        + " WHERE id = #{id}")
    int updateQuestion(@Param("id") String id, @Param("questionText") String questionText,
                       @Param("answer") String answer, @Param("questionType") String questionType,
                       @Param("score") Double score, @Param("difficulty") String difficulty,
                       @Param("knowledgePointIds") List<String> knowledgePointIds, @Param("tags") List<String> tags);

    /**
     * 删除题目。
     */
    @Delete("DELETE FROM on_site_question_library WHERE id = #{id}")
    int deleteQuestion(@Param("id") String id);

    /**
     * 查询用户角色编码（对齐 Go store/auth.go ListUserRoleCodes，用于学生视角脱敏）。
     */
    @Select("SELECT r.code"
        + " FROM roles r"
        + " JOIN user_roles ur ON ur.role_id = r.id"
        + " WHERE ur.user_id = #{userId}"
        + " ORDER BY r.created_at")
    List<String> selectRoleCodesByUserId(@Param("userId") String userId);
}
