package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 审批记录 Mapper（approval_records 表，共建提交/撤回用，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface PartnerApprovalMapper {

    @Insert("INSERT INTO approval_records (id, tenant_id, target_type, target_id, status, submitter_id, history)"
        + " VALUES (#{id}, #{tenantId}, #{targetType}, #{targetId}, 'pending', #{submitterId}, '[]'::jsonb)")
    int insertPendingApproval(@Param("id") String id, @Param("tenantId") String tenantId,
                              @Param("targetType") String targetType, @Param("targetId") String targetId,
                              @Param("submitterId") String submitterId);

    @Delete("DELETE FROM approval_records WHERE target_type = #{targetType} AND target_id = #{targetId}::uuid AND status = 'pending'")
    int deletePendingApproval(@Param("targetType") String targetType, @Param("targetId") String targetId);

    @Select("SELECT EXISTS(SELECT 1 FROM approval_records WHERE target_type = #{targetType}"
        + " AND target_id = #{targetId}::uuid AND status = 'pending')")
    boolean existsPendingApproval(@Param("targetType") String targetType, @Param("targetId") String targetId);
}
