package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationAppeal;

import java.util.List;

/**
 * 申诉记录 Mapper（appeal_records 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface EvaluationAppealMapper extends BaseMapperPlus<EvaluationAppeal, EvaluationAppeal> {

    /** 申诉列表（type/status 过滤，租户隔离，created_at 倒序，SQL 分页）。 */
    @Select("<script>SELECT id, user_id, type, reason, status, remark, tenant_id, created_at, updated_at"
        + " FROM appeal_records WHERE tenant_id = #{tenantId}"
        + " <if test=\"type != null and type != ''\">AND type = #{type}</if>"
        + " <if test=\"status != null and status != ''\">AND status = #{status}</if>"
        + " ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset}</script>")
    List<EvaluationAppeal> selectAppeals(@Param("tenantId") String tenantId, @Param("type") String type,
                                         @Param("status") String status, @Param("limit") long limit,
                                         @Param("offset") long offset);

    /** 申诉总数（与 selectAppeals 同过滤条件）。 */
    @Select("<script>SELECT COUNT(*) FROM appeal_records WHERE tenant_id = #{tenantId}"
        + " <if test=\"type != null and type != ''\">AND type = #{type}</if>"
        + " <if test=\"status != null and status != ''\">AND status = #{status}</if></script>")
    long countAppeals(@Param("tenantId") String tenantId, @Param("type") String type,
                      @Param("status") String status);

    /** 查询申诉所属租户（归属校验用）。 */
    @Select("SELECT tenant_id FROM appeal_records WHERE id = #{id}")
    String selectTenantId(@Param("id") String id);

    /** 查询单个申诉（按 id，对齐 Go Get）。 */
    @Select("SELECT id, user_id, type, reason, status, remark, tenant_id, created_at, updated_at"
        + " FROM appeal_records WHERE id = #{id}")
    EvaluationAppeal selectAppeal(@Param("id") String id);

    /** 创建申诉（status 恒为 pending）。 */
    @Insert("INSERT INTO appeal_records (id, tenant_id, user_id, type, reason, status)"
        + " VALUES (#{id}, #{tenantId}, #{userId}, #{type}, #{reason}, 'pending')")
    int insertAppeal(@Param("id") String id, @Param("tenantId") String tenantId, @Param("userId") String userId,
                     @Param("type") String type, @Param("reason") String reason);

    /** 处理申诉（更新状态，限定租户，纵深防御）。 */
    @Update("UPDATE appeal_records SET status = #{status}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateStatus(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status);
}
