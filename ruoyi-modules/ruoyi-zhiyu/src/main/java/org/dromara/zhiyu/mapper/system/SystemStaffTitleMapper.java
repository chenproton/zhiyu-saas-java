package org.dromara.zhiyu.mapper.system;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.system.SystemStaffTitle;

import java.util.List;
import java.util.Map;

/**
 * 职称 Mapper（staff_titles 表）。
 *
 * @author zhiyu
 */
public interface SystemStaffTitleMapper extends BaseMapperPlus<SystemStaffTitle, SystemStaffTitle> {

    @Insert("INSERT INTO staff_titles (id, tenant_id, code, name, description, user_count, status)"
        + " VALUES (#{id}, #{tenantId}, #{code}, #{name}, #{description}, 0, #{status})")
    int insertTitle(@Param("id") String id, @Param("tenantId") String tenantId, @Param("code") String code,
                    @Param("name") String name, @Param("description") String description, @Param("status") String status);

    @Update("UPDATE staff_titles SET name = #{name}, description = #{description},"
        + " status = COALESCE(NULLIF(#{status}, ''), status) WHERE id = #{id}")
    int updateTitle(@Param("id") String id, @Param("name") String name, @Param("description") String description,
                    @Param("status") String status);

    @Update("UPDATE staff_titles SET status = #{status} WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateStatus(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);

    @Delete("DELETE FROM staff_titles WHERE id = #{id}")
    int deleteTitle(@Param("id") String id);

    @Select("SELECT COUNT(*) FROM users WHERE tenant_id = #{tenantId} AND JSON_CONTAINS(title_ids, JSON_QUOTE(#{titleId}), '$')")
    int countUserRefs(@Param("tenantId") String tenantId, @Param("titleId") String titleId);

    @Select("<script>SELECT jt.title_id AS title_id, COUNT(*) FROM users"
        + " JOIN JSON_TABLE(users.title_ids, '$[*]' COLUMNS (title_id CHAR(36) PATH '$')) jt ON 1 = 1"
        + " WHERE tenant_id = #{tenantId} AND jt.title_id IN"
        + " <foreach collection='titleIds' item='tid' open='(' separator=',' close=')'>#{tid}</foreach>"
        + " GROUP BY jt.title_id</script>")
    List<Map<String, Object>> batchCountUsersByTitle(@Param("tenantId") String tenantId,
                                                     @Param("titleIds") List<String> titleIds);
}
