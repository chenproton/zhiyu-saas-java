package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 岗位证书绑定（position_certificates 表，Go→Java 迁移）。
 *
 * <p>表无审计时间列，不继承 {@code BaseZhiyuEntity}，自建 id 主键。
 * name/url/description/imageUrl 为 JOIN certificate_library 的结果列（非本表列）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("position_certificates")
public class JobPositionCertificate {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 岗位 ID */
    private String careerPositionId;

    /** 证书库条目 ID */
    private String certificateLibraryId;

    /** 证书名称（JOIN certificate_library，非表列） */
    private String name;

    /** 证书链接（JOIN certificate_library，非表列） */
    private String url;

    /** 证书描述（JOIN certificate_library，非表列） */
    private String description;

    /** 证书图片（JOIN certificate_library，非表列） */
    private String imageUrl;
}
