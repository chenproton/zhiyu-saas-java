package org.dromara.zhiyu.mapper.library;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.CitationBucketDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.ResourceTypeCountDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.UncitedItemDto;
import org.dromara.zhiyu.domain.library.LibraryResource;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 资源库 Mapper（resource_library 表）。
 *
 * <p>列表/详情需 LEFT JOIN users/organizations/majors 带出上传人姓名，
 * 且 resource_type 为 PG 枚举列，故走自定义 SQL（对齐 Go store/resource_library.go），
 * 参数化防注入；租户过滤由调用方（Service）强制。</p>
 *
 * @author zhiyu
 */
public interface LibraryResourceMapper extends BaseMapperPlus<LibraryResource, LibraryResource> {

    /** 资源列（含上传人 JOIN 列） */
    String SELECT_COLUMNS = "rl.id, rl.tenant_id, rl.name, rl.resource_type AS resource_type,"
        + " rl.url, rl.description, rl.thumbnail, rl.file_size, rl.metadata AS metadata, rl.uploaded_by,"
        + " u.name AS uploader_name, o.name AS uploader_org_name, m.name AS uploader_major_name,"
        + " rl.created_at, rl.updated_at";

    /** 上传人 JOIN（users/organizations/majors） */
    String JOIN_CLAUSE = "FROM resource_library rl"
        + " LEFT JOIN users u ON u.id = rl.uploaded_by"
        + " LEFT JOIN organizations o ON o.id = u.org_node_id"
        + " LEFT JOIN majors m ON m.id = u.major_id";

    /** 列表过滤条件（<script> 内 <if> 片段，供分页/计数复用） */
    String FILTER_FRAGMENT = "<where>"
        + " rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">"
        + " AND (rl.name LIKE #{search} ESCAPE '\\' OR rl.description LIKE #{search} ESCAPE '\\')"
        + " </if>"
        + " <if test=\"resourceType != null and resourceType != ''\">"
        + " AND rl.resource_type = #{resourceType}"
        + " </if>"
        + " <if test=\"orgName != null and orgName != ''\">"
        + " AND o.name = #{orgName}"
        + " </if>"
        + " <if test=\"majorName != null and majorName != ''\">"
        + " AND m.name = #{majorName}"
        + " </if>"
        + " <if test=\"uploadedBy != null and uploadedBy != ''\">"
        + " AND rl.uploaded_by = #{uploadedBy}"
        + " </if>"
        + " <if test=\"tagIds != null and tagIds.size() &gt; 0\">"
        + " AND EXISTS (SELECT 1 FROM resource_tag_relations rtr"
        + " WHERE rtr.tenant_id = rl.tenant_id"
        + " AND rtr.resource_type = 'resource_library'"
        + " AND rtr.resource_id = rl.id"
        + " AND rtr.tag_id IN"
        + " <foreach collection=\"tagIds\" item=\"tagId\" open=\"(\" separator=\",\" close=\")\">#{tagId}</foreach>)"
        + " </if>"
        + "</where>";

    /**
     * 分页查询资源列表（tenant + search/resourceType/orgName/majorName/uploadedBy/tagIds 过滤）。
     *
     * @param search 已转义 LIKE 通配符后的 %pattern% 表达式
     */
    @Select("<script>SELECT " + SELECT_COLUMNS + " " + JOIN_CLAUSE + " " + FILTER_FRAGMENT
        + " ORDER BY rl.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<LibraryResource> selectResourcePage(@Param("tenantId") String tenantId, @Param("search") String search,
                                             @Param("resourceType") String resourceType, @Param("orgName") String orgName,
                                             @Param("majorName") String majorName, @Param("uploadedBy") String uploadedBy,
                                             @Param("tagIds") List<String> tagIds,
                                             @Param("limit") int limit, @Param("offset") int offset);

    /**
     * 资源列表总数（与 {@link #selectResourcePage} 同条件）。
     */
    @Select("<script>SELECT COUNT(*) " + JOIN_CLAUSE + " " + FILTER_FRAGMENT + "</script>")
    long countResourcePage(@Param("tenantId") String tenantId, @Param("search") String search,
                           @Param("resourceType") String resourceType, @Param("orgName") String orgName,
                           @Param("majorName") String majorName, @Param("uploadedBy") String uploadedBy,
                           @Param("tagIds") List<String> tagIds);

    /**
     * 按 ID 查询资源（含上传人 JOIN；租户归属由 Service 校验）。
     */
    @Select("<script>SELECT " + SELECT_COLUMNS + " " + JOIN_CLAUSE + " WHERE rl.id = #{id}</script>")
    LibraryResource selectItemById(@Param("id") String id);

    /**
     * 按名称精确匹配查询已有资源（批量导入重名校验）。
     */
    @Select("<script>SELECT " + SELECT_COLUMNS + " " + JOIN_CLAUSE
        + " WHERE rl.tenant_id = #{tenantId} AND rl.resource_type = #{resourceType}"
        + " AND rl.name IN"
        + " <foreach collection=\"names\" item=\"name\" open=\"(\" separator=\",\" close=\")\">#{name}</foreach>"
        + "</script>")
    List<LibraryResource> selectByNames(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                                        @Param("names") List<String> names);

    /**
     * 新建资源（metadata 为 jsonb；null 时由 Service 传 "{}" 对齐 Go JSONMap 默认）。
     */
    @Insert("INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, thumbnail, file_size, metadata, uploaded_by)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{resourceType},"
        + " #{url}, #{description}, #{thumbnail}, #{fileSize}, CAST(#{metadata} AS JSON), #{uploadedBy})")
    int insertResource(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                       @Param("resourceType") String resourceType, @Param("url") String url,
                       @Param("description") String description, @Param("thumbnail") String thumbnail,
                       @Param("fileSize") Long fileSize, @Param("metadata") String metadata,
                       @Param("uploadedBy") String uploadedBy);

    /**
     * 更新资源全部字段（部分更新语义由 Service 先合并再调用）。
     */
    @Update("UPDATE resource_library SET"
        + " name = #{name}, resource_type = #{resourceType}, url = #{url},"
        + " description = #{description}, thumbnail = #{thumbnail}, file_size = #{fileSize},"
        + " metadata = CAST(#{metadata} AS JSON), updated_at = NOW()"
        + " WHERE id = #{id}")
    int updateResource(@Param("id") String id, @Param("name") String name,
                       @Param("resourceType") String resourceType, @Param("url") String url,
                       @Param("description") String description, @Param("thumbnail") String thumbnail,
                       @Param("fileSize") Long fileSize, @Param("metadata") String metadata);

    /**
     * 删除资源（关联标签绑定由 Service 在事务内先清理）。
     */
    @Delete("DELETE FROM resource_library WHERE id = #{id}")
    int deleteResource(@Param("id") String id);

    /**
     * 按类型统计资源数量（列表总览统计卡片，可选 search 过滤）。
     */
    @Select("<script>SELECT rl.resource_type AS resource_type, COUNT(*) AS count"
        + " FROM resource_library rl"
        + " <where>"
        + " rl.tenant_id = #{tenantId}"
        + " <if test=\"search != null and search != ''\">"
        + " AND (rl.name LIKE #{search} ESCAPE '\\' OR rl.description LIKE #{search} ESCAPE '\\')"
        + " </if>"
        + " </where>"
        + " GROUP BY rl.resource_type ORDER BY count DESC</script>")
    List<ResourceTypeCountDto> countByType(@Param("tenantId") String tenantId, @Param("search") String search);

    /**
     * 资源引用次数分桶（引用源：课程/节点/任务绑定；可按类型过滤）。
     */
    @Select("<script>"
        + " SELECT CASE"
        + " WHEN ref_count = 0 THEN '0次'"
        + " WHEN ref_count &lt;= 5 THEN '1-5次'"
        + " WHEN ref_count &lt;= 10 THEN '6-10次'"
        + " WHEN ref_count &lt;= 100 THEN '11-100次'"
        + " ELSE '100次以上' END AS label, COUNT(*) AS count"
        + " FROM ("
        + " SELECT rl.id,"
        + " COALESCE((SELECT COUNT(*) FROM course_resource_bindings crb WHERE crb.resource_id = rl.id), 0)"
        + " + COALESCE((SELECT COUNT(*) FROM node_resource_bindings nrb WHERE nrb.resource_id = rl.id), 0)"
        + " + COALESCE((SELECT COUNT(*) FROM task_resource_bindings trb WHERE trb.resource_id = rl.id), 0) AS ref_count"
        + " FROM resource_library rl"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"resourceType != null and resourceType != ''\">AND rl.resource_type = #{resourceType}</if>"
        + " ) refs GROUP BY label</script>")
    List<CitationBucketDto> citationBuckets(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType);

    /** 零引用过滤条件（NOT EXISTS 三个绑定表，供计数/列表复用） */
    String UNCITED_FRAGMENT = " AND NOT EXISTS (SELECT 1 FROM course_resource_bindings crb WHERE crb.resource_id = rl.id)"
        + " AND NOT EXISTS (SELECT 1 FROM node_resource_bindings nrb WHERE nrb.resource_id = rl.id)"
        + " AND NOT EXISTS (SELECT 1 FROM task_resource_bindings trb WHERE trb.resource_id = rl.id)";

    /**
     * 零引用资源总数（上传时段筛选 + 可选类型过滤）。
     */
    @Select("<script>SELECT COUNT(*) FROM resource_library rl"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"resourceType != null and resourceType != ''\">AND rl.resource_type = #{resourceType}</if>"
        + " <if test=\"from != null\">AND rl.created_at &gt;= #{from}</if>"
        + " <if test=\"to != null\">AND rl.created_at &lt; #{to}</if>"
        + UNCITED_FRAGMENT
        + "</script>")
    long countUncited(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                      @Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);

    /**
     * 零引用资源分页列表（名称 + 上传时间）。
     */
    @Select("<script>SELECT rl.id, rl.name, rl.created_at FROM resource_library rl"
        + " WHERE rl.tenant_id = #{tenantId}"
        + " <if test=\"resourceType != null and resourceType != ''\">AND rl.resource_type = #{resourceType}</if>"
        + " <if test=\"from != null\">AND rl.created_at &gt;= #{from}</if>"
        + " <if test=\"to != null\">AND rl.created_at &lt; #{to}</if>"
        + UNCITED_FRAGMENT
        + " ORDER BY rl.created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<UncitedItemDto> listUncited(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                                     @Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to,
                                     @Param("limit") int limit, @Param("offset") int offset);
}
