package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobRecommendation;

/**
 * 岗位推荐 Mapper（position_recommendations 表，Go→Java 迁移）。
 *
 * <p>详情/列表需 LEFT JOIN majors 带出专业名称，走自定义 SQL。</p>
 *
 * @author zhiyu
 */
public interface JobRecommendationMapper extends BaseMapperPlus<JobRecommendation, JobRecommendation> {

    /**
     * 按 ID 查询推荐（含专业名称；租户限定）。
     */
    @Select("""
        SELECT pr.id, pr.tenant_id, pr.major_id, COALESCE(m.name, '') AS major_name,
            pr.career_position_id, pr.position_type, pr.reason, pr.sort_order,
            pr.is_enabled, pr.created_by, pr.created_at, pr.updated_at
        FROM position_recommendations pr
        LEFT JOIN majors m ON m.id = pr.major_id
        WHERE pr.id = #{id} AND pr.tenant_id = #{tenantId}
        """)
    JobRecommendation selectRecommendById(@Param("id") String id, @Param("tenantId") String tenantId);

    /**
     * 更新推荐（限定租户）。
     */
    @Update("""
        UPDATE position_recommendations SET
            major_id = #{majorId}, career_position_id = #{careerPositionId}, position_type = #{positionType},
            reason = #{reason}, sort_order = #{sortOrder}, is_enabled = #{isEnabled}, updated_at = NOW()
        WHERE id = #{id} AND tenant_id = #{tenantId}
        """)
    int updateRecommend(@Param("id") String id, @Param("tenantId") String tenantId,
                        @Param("majorId") String majorId, @Param("careerPositionId") String careerPositionId,
                        @Param("positionType") String positionType, @Param("reason") String reason,
                        @Param("sortOrder") Integer sortOrder, @Param("isEnabled") Boolean isEnabled);

    /**
     * 删除推荐（限定租户）。
     */
    @Delete("DELETE FROM position_recommendations WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteRecommend(@Param("id") String id, @Param("tenantId") String tenantId);
}
