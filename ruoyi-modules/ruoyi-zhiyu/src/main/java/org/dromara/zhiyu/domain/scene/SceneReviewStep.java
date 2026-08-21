package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;
import org.dromara.zhiyu.core.mybatis.PgUuidArrayTypeHandler;

import java.math.BigDecimal;
import java.util.List;

/**
 * 测评评审步骤（task_review_steps 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("task_review_steps")
public class SceneReviewStep extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 所属测评方法配置 ID */
    private String configId;

    /** 步骤标签 */
    private String label;

    /** 描述 */
    private String description;

    /** 是否启用 */
    private Boolean enabled;

    /** 主体类型（enterprise_mentor 等） */
    private String subjectType;

    /** 权重 */
    private BigDecimal weight;

    /** 排序序号 */
    private Integer sortOrder;

    /** 指定评分人 ID 数组（uuid[]，仅 enterprise_mentor 持久化） */
    @TableField(typeHandler = PgUuidArrayTypeHandler.class)
    private List<String> assignedUserIds;
}
