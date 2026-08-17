package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 课程批次（lesson_batches 表，lesson 域课程批次 CRUD 与 portal 收藏列表共用）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("lesson_batches")
public class PortalLessonBatch extends BaseZhiyuEntity {

    /** 批次名称 */
    private String name;

    /** 批次编码 */
    private String code;

    /** 组织节点 ID */
    private String orgNodeId;

    /** 专业 ID */
    private String majorId;

    /** 专业名称（LEFT JOIN majors，非本表列） */
    @TableField(exist = false)
    private String majorName;

    /** 工作流 ID */
    private String workflowId;

    /** 状态（open/closed） */
    private String status;

    /** 课程数量 */
    private Integer courseCount;

    /** 租户 ID */
    private String tenantId;
}
