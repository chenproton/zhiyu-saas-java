package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 人才画像排名-专业启用配置（brand_major_rank_configs 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("brand_major_rank_configs")
public class BrandMajorRankConfig extends BaseZhiyuEntity {

    private String tenantId;
    private String majorId;
    private Boolean enabled;
    private Integer rankLimit;
}
