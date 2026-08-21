package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.math.BigDecimal;
import java.util.List;

/**
 * 岗位-能力绑定（position_ability_bindings 表，Go→Java 迁移）。
 *
 * <p>表无审计时间列，不继承 {@code BaseZhiyuEntity}，自建 id 主键。
 * abilityName 为 LEFT JOIN ability_points 的结果列（非本表列）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("position_ability_bindings")
public class JobPositionAbilityBinding {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 岗位 ID */
    private String careerPositionId;

    /** 职责 ID */
    private String responsibilityId;

    /** 能力点 ID */
    private String abilityPointId;

    /** 能力点名称（JOIN ability_points，非表列） */
    @TableField(exist = false)
    private String abilityName;

    /** 来源（public=公共池引用 / custom=自建） */
    private String source;

    /** 能力域（冗余字段） */
    private String domain;

    /** 要求等级 */
    private String requiredLevel;

    /** 量规表现描述 */
    private String rubricDescription;

    /** 属性标签（JSON 数组列，原 PG text[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> attributes;

    /** 权重（numeric(5,2)） */
    private BigDecimal weight;
}
