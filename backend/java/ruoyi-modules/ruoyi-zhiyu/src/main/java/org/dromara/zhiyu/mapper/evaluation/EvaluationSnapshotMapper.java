package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot;

import java.util.Map;

/**
 * 资源快照 Mapper（resource_snapshots 表；读取一律限定租户，防跨租户读快照）。
 *
 * @author zhiyu
 */
public interface EvaluationSnapshotMapper extends BaseMapperPlus<EvaluationResourceSnapshot, EvaluationResourceSnapshot> {

    /** 最新快照版本（无快照返回空串，调用方回退 live 当前版本） */
    @Select("SELECT version FROM resource_snapshots"
        + " WHERE tenant_id = #{tenantId} AND resource_type = #{resourceType} AND resource_id = #{resourceId}"
        + " ORDER BY created_at DESC, id DESC LIMIT 1")
    String latestVersion(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                         @Param("resourceId") String resourceId);

    /** 资源 live 行的当前版本与状态（限定租户；快照缺档回退判定用，返回 version/status） */
    @Select("<script>"
        + " <choose><when test='resourceType == \"exams\"'>SELECT COALESCE(version, '') AS version, status FROM exams</when>"
        + " <when test='resourceType == \"question_banks\"'>SELECT COALESCE(version, '') AS version, status FROM question_banks</when>"
        + " <when test='resourceType == \"scenarios\"'>SELECT COALESCE(version, '') AS version, status FROM scenarios</when>"
        + " <when test='resourceType == \"courses\"'>SELECT COALESCE(version, '') AS version, status FROM courses</when>"
        + " <otherwise>SELECT COALESCE(version, '') AS version, status FROM career_positions</otherwise></choose>"
        + " WHERE tenant_id = #{tenantId} AND id = #{resourceId}</script>")
    Map<String, Object> liveVersion(@Param("tenantId") String tenantId, @Param("resourceType") String resourceType,
                                    @Param("resourceId") String resourceId);
}
