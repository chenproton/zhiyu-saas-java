package org.dromara.zhiyu.mapper.library;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.TagRelationRow;
import org.dromara.zhiyu.domain.library.LibraryResourceTagRelation;

import java.util.List;

/**
 * 资源-标签绑定 Mapper（resource_tag_relations 表，多态引用）。
 *
 * <p>全量替换与批量查询均走自定义 SQL（事务由 Service 编排），
 * 插入 ON CONFLICT DO NOTHING 对齐 Go 幂等语义。</p>
 *
 * @author zhiyu
 */
public interface LibraryResourceTagRelationMapper extends BaseMapperPlus<LibraryResourceTagRelation, LibraryResourceTagRelation> {

    /**
     * 删除某资源（某资源类型）的全部标签绑定（租户内）。
     */
    @Delete("""
        DELETE FROM resource_tag_relations
        WHERE tenant_id = #{tenantId}::uuid AND resource_type = #{resourceType} AND resource_id = #{resourceId}
        """)
    int deleteByResource(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                         @Param("resourceId") String resourceId);

    /**
     * 删除某资源的全部标签绑定（不带租户条件；供资源物理删除时级联清理复用，对齐 Go DeleteResourceTags）。
     */
    @Delete("""
        DELETE FROM resource_tag_relations
        WHERE resource_type = #{resourceType} AND resource_id = #{resourceId}
        """)
    int deleteByResourceGlobal(@Param("resourceType") String resourceType, @Param("resourceId") String resourceId);

    /**
     * 插入绑定（冲突静默，幂等）。
     */
    @Insert("""
        INSERT INTO resource_tag_relations (id, tenant_id, tag_id, resource_type, resource_id)
        VALUES (#{id}, #{tenantId}::uuid, #{tagId}::uuid, #{resourceType}, #{resourceId}::uuid)
        ON CONFLICT (tenant_id, resource_type, resource_id, tag_id) DO NOTHING
        """)
    int insertRelation(@Param("id") String id, @Param("tenantId") String tenantId, @Param("tagId") String tagId,
                       @Param("resourceType") String resourceType, @Param("resourceId") String resourceId);

    /**
     * 批量查询资源标签绑定（一页资源一次 IN 查询，供列表页标签展示）。
     */
    @Select("""
        <script>
        SELECT rtr.resource_id, t.id AS tag_id, t.tenant_id, t.name, t.color, t.created_at, t.updated_at
        FROM resource_tag_relations rtr
        JOIN tags t ON t.id = rtr.tag_id
        WHERE rtr.tenant_id = #{tenantId}::uuid AND rtr.resource_type = #{resourceType}
          AND rtr.resource_id IN
          <foreach collection="resourceIds" item="rid" open="(" separator="," close=")">#{rid}::uuid</foreach>
        ORDER BY t.created_at DESC
        </script>
        """)
    List<TagRelationRow> selectTagRelations(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                                            @Param("resourceIds") List<String> resourceIds);
}
