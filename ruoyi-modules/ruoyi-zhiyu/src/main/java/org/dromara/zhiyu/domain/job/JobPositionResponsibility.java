package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * 岗位职责（position_responsibilities 表，Go→Java 迁移）。
 *
 * <p>表无审计时间列，不继承 {@code BaseZhiyuEntity}，自建 id 主键。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("position_responsibilities")
public class JobPositionResponsibility {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 岗位 ID */
    private String careerPositionId;

    /** 职责名称 */
    private String name;

    /** 职责描述 */
    private String description;

    /** 排序 */
    private Integer sortOrder;
}
