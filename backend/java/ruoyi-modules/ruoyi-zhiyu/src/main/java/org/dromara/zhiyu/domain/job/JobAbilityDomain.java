package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgUuidArrayTypeHandler;

import java.util.List;

/**
 * 能力域（ability_domains 表，Go→Java 迁移）。
 *
 * <p>表无审计时间列，不继承 {@code BaseZhiyuEntity}，自建 id 主键。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ability_domains")
public class JobAbilityDomain {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 岗位 ID */
    private String careerPositionId;

    /** 能力域名称 */
    private String name;

    /** 能力域描述 */
    private String description;

    /** 包含的能力绑定 ID 数组（uuid[]） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> bindingIds;

    /** 排序 */
    private Integer sortOrder;
}
