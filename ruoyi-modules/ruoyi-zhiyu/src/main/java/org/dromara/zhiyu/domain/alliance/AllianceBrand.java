package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 品牌内容（alliance_brands 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_brands")
public class AllianceBrand extends BaseZhiyuEntity {

    private String tenantId;
    private String brandType;
    private String name;
    private String status;
    private Boolean isPublic;
    private Boolean isFeatured;
    private String coverImage;
    private String coverVideo;
    private String description;
    /** jsonb 对象（data），JSON 原文 */
    private String data;
    private String studentId;
    private String enterpriseId;
    private String positionId;
    private String majorId;
    private String teacherId;
    private String expertId;
    private Integer sortOrder;
    private Integer viewCount;
}
