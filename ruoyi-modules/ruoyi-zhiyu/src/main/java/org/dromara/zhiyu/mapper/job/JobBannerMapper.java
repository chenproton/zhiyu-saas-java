package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobBannerConfig;

/**
 * 岗位轮播图 Mapper（banner_configs 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface JobBannerMapper extends BaseMapperPlus<JobBannerConfig, JobBannerConfig> {

    /**
     * 更新轮播图（限定租户）。
     */
    @Update("UPDATE banner_configs SET title = #{title}, image_url = #{imageUrl}, link_url = #{linkUrl},"
        + " sort_order = #{sortOrder}, is_enabled = #{isEnabled}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateBanner(@Param("id") String id, @Param("tenantId") String tenantId, @Param("title") String title,
                     @Param("imageUrl") String imageUrl, @Param("linkUrl") String linkUrl,
                     @Param("sortOrder") Integer sortOrder, @Param("isEnabled") Boolean isEnabled);

    /**
     * 删除轮播图（限定租户）。
     */
    @Delete("DELETE FROM banner_configs WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteBanner(@Param("id") String id, @Param("tenantId") String tenantId);
}
