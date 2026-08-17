package org.dromara.zhiyu.mapper.library;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.library.LibraryTag;

import java.util.List;

/**
 * 标签 Mapper（tags 表）。
 *
 * <p>列表需带资源绑定数量（LEFT JOIN resource_tag_relations 统计），
 * 更新/删除带 tenant 条件作纵深防御（租户归属已由 Service 校验）。</p>
 *
 * @author zhiyu
 */
public interface LibraryTagMapper extends BaseMapperPlus<LibraryTag, LibraryTag> {

    /**
     * 查询租户全部标签，附带各自绑定的资源数量（ORDER BY created_at DESC）。
     */
    @Select("""
        SELECT t.id, t.tenant_id, t.name, t.color, t.created_at, t.updated_at,
               COALESCE(cnt.cnt, 0) AS resource_count
        FROM tags t
        LEFT JOIN (
            SELECT tag_id, COUNT(*) AS cnt
            FROM resource_tag_relations
            WHERE tenant_id = #{tenantId}::uuid
            GROUP BY tag_id
        ) cnt ON cnt.tag_id = t.id
        WHERE t.tenant_id = #{tenantId}::uuid
        ORDER BY t.created_at DESC
        """)
    List<LibraryTag> selectWithResourceCount(@Param("tenantId") String tenantId);

    /**
     * 更新标签名称/颜色（带租户条件）。
     */
    @Update("""
        UPDATE tags SET name = #{name}, color = #{color}, updated_at = NOW()
        WHERE id = #{id} AND tenant_id = #{tenantId}::uuid
        """)
    int updateOwned(@Param("id") String id, @Param("tenantId") String tenantId,
                    @Param("name") String name, @Param("color") String color);

    /**
     * 删除标签（带租户条件；绑定关系由 FK ON DELETE CASCADE 自动清理）。
     */
    @Delete("DELETE FROM tags WHERE id = #{id} AND tenant_id = #{tenantId}::uuid")
    int deleteOwned(@Param("id") String id, @Param("tenantId") String tenantId);
}
