package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobCertificateLibraryItem;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 证书库 Mapper（certificate_library 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface JobCertificateLibraryMapper extends BaseMapperPlus<JobCertificateLibraryItem, JobCertificateLibraryItem> {

    /** 引用分桶行（bucket 聚合查询结果）。 */
    class CitationCountRow {
        public String label;
        public Integer count;
    }

    /**
     * 证书引用次数分布（引用源：岗位证书绑定；对齐 Go CitationStats）。
     */
    @Select("""
        SELECT bucket, COUNT(*) AS cnt FROM (
            SELECT cl.id,
                COALESCE((SELECT COUNT(*) FROM position_certificates pc WHERE pc.certificate_library_id = cl.id), 0) AS ref_count
            FROM certificate_library cl
            WHERE cl.tenant_id = #{tenantId}
        ) refs
        GROUP BY bucket
        """)
    List<CitationCountRow> selectCitationStats(@Param("tenantId") String tenantId);

    /**
     * 零引用证书列表（创建时段筛选 + 分页；对齐 Go ListUncited）。
     */
    @Select("""
        <script>
        SELECT cl.id, cl.name, cl.created_at
        FROM certificate_library cl
        WHERE cl.tenant_id = #{tenantId}
        <if test="from != null">AND cl.created_at &gt;= #{from}</if>
        <if test="to != null">AND cl.created_at &lt; #{to}</if>
        AND NOT EXISTS (SELECT 1 FROM position_certificates pc WHERE pc.certificate_library_id = cl.id)
        ORDER BY cl.created_at DESC
        LIMIT #{limit} OFFSET #{offset}
        </script>
        """)
    List<JobCertificateLibraryItem> selectUncited(@Param("tenantId") String tenantId,
                                                  @Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to,
                                                  @Param("limit") int limit, @Param("offset") int offset);

    /**
     * 零引用证书总数（与 {@link #selectUncited} 同条件）。
     */
    @Select("""
        <script>
        SELECT COUNT(*) FROM certificate_library cl
        WHERE cl.tenant_id = #{tenantId}
        <if test="from != null">AND cl.created_at &gt;= #{from}</if>
        <if test="to != null">AND cl.created_at &lt; #{to}</if>
        AND NOT EXISTS (SELECT 1 FROM position_certificates pc WHERE pc.certificate_library_id = cl.id)
        </script>
        """)
    long countUncited(@Param("tenantId") String tenantId, @Param("from") OffsetDateTime from,
                      @Param("to") OffsetDateTime to);
}
