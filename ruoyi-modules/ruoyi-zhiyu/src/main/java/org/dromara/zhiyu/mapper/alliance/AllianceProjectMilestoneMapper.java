package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceProjectMilestone;

import java.util.List;

/**
 * 项目里程碑 Mapper（alliance_project_milestones 表）。
 *
 * @author zhiyu
 */
public interface AllianceProjectMilestoneMapper extends BaseMapperPlus<AllianceProjectMilestone, AllianceProjectMilestone> {

    String COLS = "id, tenant_id, project_id, name, description, due_date, completed_date, is_completed, sort_order, created_at, updated_at";

    @Insert("INSERT INTO alliance_project_milestones (id, tenant_id, project_id, name, description, due_date,"
        + " completed_date, is_completed, sort_order, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{projectId}, #{name}, #{description}, #{dueDate}, #{completedDate},"
        + " #{isCompleted}, #{sortOrder}, NOW(), NOW())")
    int insertMilestone(AllianceProjectMilestone m);

    @Update("UPDATE alliance_project_milestones SET name = #{name}, description = #{description},"
        + " due_date = #{dueDate}, completed_date = #{completedDate}, is_completed = #{isCompleted},"
        + " sort_order = #{sortOrder}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateMilestone(AllianceProjectMilestone m);

    @Delete("DELETE FROM alliance_project_milestones WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteMilestone(@Param("id") String id, @Param("tenantId") String tenantId);

    @Select("SELECT " + COLS + " FROM alliance_project_milestones m"
        + " JOIN alliance_projects p ON p.id = m.project_id"
        + " WHERE m.project_id = #{projectId} AND p.is_public = true AND p.tenant_id = #{tenantId}"
        + " ORDER BY m.sort_order ASC")
    List<AllianceProjectMilestone> listPublicMilestonesByTenant(@Param("projectId") String projectId,
                                                                @Param("tenantId") String tenantId);

    @Select("SELECT " + COLS + " FROM alliance_project_milestones m"
        + " JOIN alliance_projects p ON p.id = m.project_id"
        + " WHERE m.project_id = #{projectId} AND p.is_public = true ORDER BY m.sort_order ASC")
    List<AllianceProjectMilestone> listPublicMilestonesGlobal(@Param("projectId") String projectId);
}
