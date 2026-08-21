package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import org.dromara.zhiyu.core.mybatis.JsonStringArrayTypeHandler;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 能力点（ability_points 表，Go→Java 迁移）。
 *
 * <p>表仅有 created_at（无 updated_at），故不继承 {@code BaseZhiyuEntity}，
 * 自建 id 主键（ASSIGN_UUID 等价 PG gen_random_uuid 语义）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ability_points")
public class JobAbilityPoint {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 能力点名称 */
    private String name;

    /** 能力点描述 */
    private String description;

    /** 能力编码（NL-XXXX） */
    private String code;

    /** 属性标签（text[]） */
    @TableField(typeHandler = JsonStringArrayTypeHandler.class)
    private List<String> attributes;

    /** 是否公开（公共池引用） */
    private Boolean isPublic;

    /** 创建人 ID */
    private String creatorId;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
