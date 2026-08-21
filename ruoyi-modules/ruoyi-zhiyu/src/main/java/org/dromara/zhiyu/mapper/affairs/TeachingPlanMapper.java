package org.dromara.zhiyu.mapper.affairs;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.affairs.TeachingPlan;

import java.util.List;

/**
 * 教学计划 Mapper（teaching_plans 表 + 条目班级 junction 辅助）。
 *
 * @author zhiyu
 */
public interface TeachingPlanMapper extends BaseMapperPlus<TeachingPlan, TeachingPlan> {

    /** 插入条目班级关联。 */
    @Insert("INSERT INTO teaching_plan_entry_classes (entry_id, class_node_id) VALUES (#{entryId}, #{classNodeId})")
    int insertEntryClass(@Param("entryId") String entryId, @Param("classNodeId") String classNodeId);

    /** 删除条目全部班级关联。 */
    @Delete("DELETE FROM teaching_plan_entry_classes WHERE entry_id = #{entryId}")
    int deleteEntryClasses(@Param("entryId") String entryId);

    /** 查询条目班级关联（按 class_node_id 排序对齐 Go）。 */
    @Select("SELECT class_node_id FROM teaching_plan_entry_classes WHERE entry_id = #{entryId} ORDER BY class_node_id")
    List<String> selectEntryClassIds(@Param("entryId") String entryId);

    /** 查询学期周数。 */
    @Select("SELECT weeks_count FROM terms WHERE id = #{id} AND tenant_id = #{tenantId}")
    Integer termWeeks(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 查询已存在计划（生成校验）。 */
    @Select("SELECT id FROM teaching_plans WHERE program_id = #{programId} AND term_id = #{termId} AND tenant_id = #{tenantId}")
    String findExistingPlan(@Param("programId") String programId, @Param("termId") String termId,
                            @Param("tenantId") String tenantId);

    /** 统计计划已排课条目数。 */
    @Select("""
        SELECT COUNT(*) FROM teaching_plan_entries e
        JOIN schedule_entries se ON se.plan_entry_id = e.id
        WHERE e.plan_id = #{planId}
        """)
    int scheduledEntryCount(@Param("planId") String planId);

    /** 确认计划（draft → published + 确认时间）。 */
    @Update("UPDATE teaching_plans SET status = 'published', confirmed_at = NOW(), updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int confirmPlan(@Param("id") String id, @Param("tenantId") String tenantId);

    /** 发布流转后记录确认时间（同一事务）。 */
    @Update("UPDATE teaching_plans SET confirmed_at = NOW() WHERE id = #{id}")
    int markConfirmed(@Param("id") String id);

    /** 生成前删除旧计划（同方案+学期）。 */
    @Delete("DELETE FROM teaching_plans WHERE program_id = #{programId} AND term_id = #{termId} AND tenant_id = #{tenantId}")
    int deleteByProgramTerm(@Param("programId") String programId, @Param("termId") String termId,
                            @Param("tenantId") String tenantId);

    /** 查询方案关联专业在组织树中的班级节点。 */
    @Select("""
        WITH RECURSIVE major_org AS (
            SELECT o.id
            FROM organizations o
            JOIN org_types t ON t.id = o.type_id AND t.tenant_id = o.tenant_id
            WHERE o.tenant_id = #{tenantId} AND t.name = '专业'
              AND o.name = (SELECT name FROM majors WHERE id = #{majorId})
        ),
        org_tree AS (
            SELECT o.id, o.type_id
            FROM organizations o
            JOIN major_org mo ON mo.id = o.id
            UNION ALL
            SELECT o.id, o.type_id
            FROM organizations o
            JOIN org_tree c ON c.id = o.parent_id
        )
        SELECT DISTINCT ot.id
        FROM org_tree ot
        JOIN organizations o ON o.id = ot.id
        JOIN org_types t ON t.id = o.type_id AND t.tenant_id = o.tenant_id
        WHERE t.name = '班级'
        """)
    List<String> fetchProgramClasses(@Param("tenantId") String tenantId, @Param("majorId") String majorId);

    /** CAS 状态流转。 */
    @Update("UPDATE teaching_plans SET status = #{to}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId} AND status = #{from}")
    int casTransition(@Param("id") String id, @Param("tenantId") String tenantId,
                      @Param("from") String from, @Param("to") String to);

    /** CAS 审核（仅 pending 可审）。 */
    @Update("UPDATE teaching_plans SET status = #{to}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId} AND status = 'pending'")
    int casReview(@Param("id") String id, @Param("tenantId") String tenantId, @Param("to") String to);

    /** 撤回时删除待审批记录。 */
    @Delete("DELETE FROM approval_records WHERE target_type = 'teaching_plan' AND target_id = #{id} AND status = 'pending'")
    int deletePendingApproval(@Param("id") String id);

    /** 邀请协作者（去重追加）。 */
    @Update("""
        UPDATE teaching_plans SET collaborators = JSON_ARRAY_APPEND(collaborators, '$', #{userId}), updated_at = NOW()
        WHERE id = #{id} AND NOT (JSON_CONTAINS(collaborators, JSON_QUOTE(#{userId}), '$'))
        """)
    int inviteCollaborator(@Param("id") String id, @Param("userId") String userId);

    /** 更新批次绑定。 */
    @Update("UPDATE teaching_plans SET batch_id = #{batchId}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateBatch(@Param("id") String id, @Param("tenantId") String tenantId, @Param("batchId") String batchId);

    /** 更新共建人数组。 */
    @Update("""
        UPDATE teaching_plans SET collaborators = #{collaborators, typeHandler = org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler}, updated_at = NOW()
        WHERE id = #{id} AND tenant_id = #{tenantId}
        """)
    int updateCollaborators(@Param("id") String id, @Param("tenantId") String tenantId,
                            @Param("collaborators") List<String> collaborators);
}
