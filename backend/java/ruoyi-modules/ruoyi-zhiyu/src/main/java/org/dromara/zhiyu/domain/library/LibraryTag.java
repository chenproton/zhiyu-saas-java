package org.dromara.zhiyu.domain.library;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 资源标签（tags 表，租户内 name 唯一）。
 *
 * <p>resourceCount 为标签绑定资源数量（JOIN resource_tag_relations 统计），
 * 非表列，由自定义 SQL 填充。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("tags")
public class LibraryTag extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 标签名称（租户内唯一，≤64 字符） */
    private String name;

    /** 颜色（#RRGGBB） */
    private String color;

    /** 绑定资源数量（非表列） */
    @TableField(exist = false)
    private Integer resourceCount;
}
