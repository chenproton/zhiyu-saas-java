package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 岗位轮播图（banner_configs 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("banner_configs")
public class JobBannerConfig extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 标题 */
    private String title;

    /** 图片地址 */
    private String imageUrl;

    /** 跳转链接 */
    private String linkUrl;

    /** 排序 */
    private Integer sortOrder;

    /** 是否启用 */
    private Boolean isEnabled;
}
