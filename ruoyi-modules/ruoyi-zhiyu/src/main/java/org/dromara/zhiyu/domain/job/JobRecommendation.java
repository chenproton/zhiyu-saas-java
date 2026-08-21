package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 岗位推荐位（position_recommendations 表，Go→Java 迁移）。
 *
 * <p>majorName 为 LEFT JOIN majors 的结果列（非本表列）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("position_recommendations")
public class JobRecommendation extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 专业 ID */
    private String majorId;

    /** 专业名称（JOIN majors 结果列，非表列；泛型 selectList 必须排除，否则 SQL 引用不存在的 major_name 列） */
    @TableField(exist = false)
    private String majorName;

    /** 岗位 ID */
    private String careerPositionId;

    /** 岗位类型（enterprise/teaching） */
    private String positionType;

    /** 推荐原因 */
    private String reason;

    /** 展示顺序（越小越靠前） */
    private Integer sortOrder;

    /** 是否在前台展示 */
    private Boolean isEnabled;

    /** 配置人（老师）ID */
    private String createdBy;
}
