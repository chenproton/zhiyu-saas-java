package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobCareerPosition;

import java.util.List;

/**
 * 落地页 Mapper（landing 页数据，Go→Java 迁移）。
 *
 * <p>目标岗位查询依赖组织树 WITH RECURSIVE 上行递归（学生班级节点 → 专业节点），
 * 按「两次查询 + 组装」策略：本 Mapper 只返回岗位 ID 列表，
 * 岗位详情/关联名称由 Service 复用岗位列表的批量组装逻辑。</p>
 *
 * @author zhiyu
 */
public interface JobLandingMapper extends BaseMapperPlus<JobCareerPosition, JobCareerPosition> {

    /**
     * 查询学生目标岗位 ID 列表（对齐 Go LandingStore.ListTargetPositions）。
     *
     * <p>链路：学生班级节点 → 组织树向上找「专业」节点 → 名称匹配 majors →
     * 该专业已发布人培方案 → 方案岗位课程 → 已发布岗位。结果按岗位创建时间倒序。</p>
     */
    @Select("""
        WITH RECURSIVE up_tree AS (
            SELECT o.id, o.type_id, o.parent_id
            FROM organizations o
            WHERE o.id = (SELECT org_node_id FROM users WHERE id = #{userId})
            UNION ALL
            SELECT o.id, o.type_id, o.parent_id
            FROM organizations o
            JOIN up_tree ut ON o.id = ut.parent_id
        )
        SELECT DISTINCT cp.id
        FROM career_positions cp
        JOIN training_program_courses pc ON pc.position_id = cp.id
        JOIN training_programs tp ON tp.id = pc.program_id AND tp.status = 'published'
        JOIN majors m ON m.id = tp.major_id AND m.tenant_id = #{tenantId}
        JOIN organizations maj_org ON maj_org.tenant_id = #{tenantId} AND maj_org.name = m.name
        JOIN org_types mt ON mt.id = maj_org.type_id AND mt.name = '专业'
        JOIN up_tree ut ON ut.id = maj_org.id
        WHERE cp.tenant_id = #{tenantId} AND cp.status = 'published'
        ORDER BY cp.created_at DESC
        """)
    List<String> selectTargetPositionIds(@Param("tenantId") String tenantId, @Param("userId") String userId);
}
