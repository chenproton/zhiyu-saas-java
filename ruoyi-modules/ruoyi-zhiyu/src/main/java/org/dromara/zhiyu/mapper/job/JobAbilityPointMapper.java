package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobAbilityPoint;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 能力点 Mapper（ability_points 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface JobAbilityPointMapper extends BaseMapperPlus<JobAbilityPoint, JobAbilityPoint> {

    /** 引用分桶行（bucket 聚合查询结果）。 */
    class CitationCountRow {
        public String label;
        public Integer count;
    }

    /**
     * 能力点引用次数分布（引用源：岗位职责/节点/场景任务/认证绑定；对齐 Go CitationStats）。
     */
    @Select("""
        SELECT bucket, COUNT(*) AS cnt FROM (
            SELECT ap.id,
                COALESCE((SELECT COUNT(*) FROM position_ability_bindings pab WHERE pab.ability_point_id = ap.id), 0)
                + COALESCE((SELECT COUNT(*) FROM node_ability_point_bindings nab WHERE nab.ability_point_id = ap.id), 0)
                + COALESCE((SELECT COUNT(*) FROM task_ability_bindings tab WHERE tab.ability_point_id = ap.id), 0)
                + COALESCE((SELECT COUNT(*) FROM certification_ability_points cap WHERE cap.ability_point_id = ap.id), 0) AS ref_count
            FROM ability_points ap
            WHERE ap.tenant_id = #{tenantId}
        ) refs
        GROUP BY bucket
        """)
    List<CitationCountRow> selectCitationStats(@Param("tenantId") String tenantId);

    /**
     * 零引用能力点 ID 列表（创建时段筛选 + 分页；对齐 Go ListUncited）。
     */
    @Select("""
        <script>
        SELECT ap.id, ap.name, ap.created_at
        FROM ability_points ap
        WHERE ap.tenant_id = #{tenantId}
        <if test="from != null">AND ap.created_at &gt;= #{from}</if>
        <if test="to != null">AND ap.created_at &lt; #{to}</if>
        AND NOT EXISTS (SELECT 1 FROM position_ability_bindings pab WHERE pab.ability_point_id = ap.id)
        AND NOT EXISTS (SELECT 1 FROM node_ability_point_bindings nab WHERE nab.ability_point_id = ap.id)
        AND NOT EXISTS (SELECT 1 FROM task_ability_bindings tab WHERE tab.ability_point_id = ap.id)
        AND NOT EXISTS (SELECT 1 FROM certification_ability_points cap WHERE cap.ability_point_id = ap.id)
        ORDER BY ap.created_at DESC
        LIMIT #{limit} OFFSET #{offset}
        </script>
        """)
    List<JobAbilityPoint> selectUncited(@Param("tenantId") String tenantId, @Param("from") OffsetDateTime from,
                                        @Param("to") OffsetDateTime to, @Param("limit") int limit,
                                        @Param("offset") int offset);

    /**
     * 零引用能力点总数（与 {@link #selectUncited} 同条件）。
     */
    @Select("""
        <script>
        SELECT COUNT(*) FROM ability_points ap
        WHERE ap.tenant_id = #{tenantId}
        <if test="from != null">AND ap.created_at &gt;= #{from}</if>
        <if test="to != null">AND ap.created_at &lt; #{to}</if>
        AND NOT EXISTS (SELECT 1 FROM position_ability_bindings pab WHERE pab.ability_point_id = ap.id)
        AND NOT EXISTS (SELECT 1 FROM node_ability_point_bindings nab WHERE nab.ability_point_id = ap.id)
        AND NOT EXISTS (SELECT 1 FROM task_ability_bindings tab WHERE tab.ability_point_id = ap.id)
        AND NOT EXISTS (SELECT 1 FROM certification_ability_points cap WHERE cap.ability_point_id = ap.id)
        </script>
        """)
    long countUncited(@Param("tenantId") String tenantId, @Param("from") OffsetDateTime from,
                      @Param("to") OffsetDateTime to);

    /**
     * 校验能力编码在租户内是否存在（code 唯一性判定）。
     */
    @Select("SELECT EXISTS(SELECT 1 FROM ability_points WHERE tenant_id = #{tenantId} AND code = #{code})")
    boolean existsCode(@Param("tenantId") String tenantId, @Param("code") String code);
}
