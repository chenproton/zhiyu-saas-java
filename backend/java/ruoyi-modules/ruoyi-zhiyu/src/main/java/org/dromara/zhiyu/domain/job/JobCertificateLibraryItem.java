package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 证书库条目（certificate_library 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("certificate_library")
public class JobCertificateLibraryItem extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 证书名称 */
    private String name;

    /** 证书链接 */
    private String url;

    /** 证书描述 */
    private String description;

    /** 证书图片 */
    private String imageUrl;

    /** 创建人 ID */
    private String creatorId;
}
