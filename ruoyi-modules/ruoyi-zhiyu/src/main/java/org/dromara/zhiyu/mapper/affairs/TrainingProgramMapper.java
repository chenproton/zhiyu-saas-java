package org.dromara.zhiyu.mapper.affairs;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.affairs.TrainingProgram;

/**
 * 人才培养方案 Mapper（training_programs 表）。
 *
 * @author zhiyu
 */
public interface TrainingProgramMapper extends BaseMapperPlus<TrainingProgram, TrainingProgram> {

    /** 方案是否属于指定租户（导入/跨模块归属校验用）。 */
    @org.apache.ibatis.annotations.Select("SELECT EXISTS(SELECT 1 FROM training_programs WHERE id = #{id} AND tenant_id = #{tenantId})")
    boolean programExists(@Param("id") String id, @Param("tenantId") String tenantId);

    /**
     * 克隆课程（对齐 Go CloneProgram：复制 10 列，theory/practice 取默认 0）。
     */
    @Insert("""
        INSERT INTO training_program_courses (program_id, name, code, credits, hours, semester, nature, assessment, position_id, course_id, sort_order)
        SELECT #{newId}, name, code, credits, hours, semester, nature, assessment, position_id, course_id, sort_order
        FROM training_program_courses WHERE program_id = #{srcId}
        """)
    int cloneCourses(@Param("newId") String newId, @Param("srcId") String srcId);

    /** CAS 状态流转（仅当当前状态仍匹配才更新，防并发双发）。 */
    @Update("UPDATE training_programs SET status = #{to}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId} AND status = #{from}")
    int casTransition(@Param("id") String id, @Param("tenantId") String tenantId,
                      @Param("from") String from, @Param("to") String to);

    /** CAS 审核（仅 pending 可审）。 */
    @Update("UPDATE training_programs SET status = #{to}, updated_at = NOW() WHERE id = #{id} AND tenant_id = #{tenantId} AND status = 'pending'")
    int casReview(@Param("id") String id, @Param("tenantId") String tenantId, @Param("to") String to);

    /** 撤回时删除待审批记录。 */
    @Delete("DELETE FROM approval_records WHERE target_type = 'training_program' AND target_id = #{id} AND status = 'pending'")
    int deletePendingApproval(@Param("id") String id);

    /** 邀请协作者（去重追加）。 */
    @Update("""
        UPDATE training_programs SET collaborators = JSON_ARRAY_APPEND(collaborators, '$', #{userId}), updated_at = NOW()
        WHERE id = #{id} AND NOT (JSON_CONTAINS(collaborators, JSON_QUOTE(#{userId}), '$'))
        """)
    int inviteCollaborator(@Param("id") String id, @Param("userId") String userId);

    /** 刷新 updated_at（保存课程设置时）。 */
    @Update("UPDATE training_programs SET updated_at = NOW() WHERE id = #{id}")
    int touchUpdatedAt(@Param("id") String id);
}
