package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;
import org.dromara.zhiyu.domain.job.JobLearnRoad;

import java.util.List;

/**
 * 学习路径 Mapper（learn_roads 表，Go→Java 迁移）。
 *
 * <p>steps 为 MySQL JSON 列，写入需显式 CAST 为 JSON；position_ids 为 JSON 数组列（原 PG uuid[]）。</p>
 *
 * @author zhiyu
 */
public interface JobLearnRoadMapper extends BaseMapperPlus<JobLearnRoad, JobLearnRoad> {

    /**
     * 更新学习路径（限定租户；steps 显式 CAST 为 JSON，position_ids 经 JsonStringArrayTypeHandler 绑定）。
     */
    @Update("UPDATE learn_roads SET name = #{name}, description = #{description},"
        + " position_ids = #{positionIds, typeHandler=org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler},"
        + " steps = CAST(#{steps} AS JSON), updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateLearnRoad(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                        @Param("description") String description, @Param("positionIds") List<String> positionIds,
                        @Param("steps") String steps);

    /**
     * 删除学习路径（限定租户）。
     */
    @Delete("DELETE FROM learn_roads WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteLearnRoad(@Param("id") String id, @Param("tenantId") String tenantId);
}
