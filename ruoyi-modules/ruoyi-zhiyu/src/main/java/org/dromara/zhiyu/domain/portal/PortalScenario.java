package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 实践场景（scenarios 表，工作台/收藏列表子集字段）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("scenarios")
public class PortalScenario extends BaseZhiyuEntity {

    /** 场景名称 */
    private String name;

    /** 场景编码 */
    private String code;

    /** 封面图 */
    private String coverImage;

    /** 关联岗位 ID */
    private String careerPositionId;

    /** 关联行业 ID 数组（varchar[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> industryIds;

    /** 关联专业 ID 数组（uuid[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> professionIds;

    /** 批次 ID */
    private String batchId;

    /** 难度（1-5） */
    private Integer difficulty;

    /** 版本号 */
    private String version;

    /** 状态 */
    private String status;

    /** 场景背景 */
    private String background;

    /** 交付目标 */
    private String deliveryGoal;

    /** 创建人 */
    @TableField("creator_id")
    private String creatorId;

    /** 共建人 ID 数组 */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> coBuilderIds;

    /** 租户 ID */
    private String tenantId;

    /** 发布时间 */
    private OffsetDateTime publishTime;

    /** 来源类型（school/enterprise） */
    private String sourceType;

    /** 来源企业 ID */
    private String sourceEnterpriseId;
}
