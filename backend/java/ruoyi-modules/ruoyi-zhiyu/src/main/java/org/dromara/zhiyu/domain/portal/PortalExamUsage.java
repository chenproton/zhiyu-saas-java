package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.OffsetDateTime;

/**
 * 考试安排（exam_usages 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("exam_usages")
public class PortalExamUsage extends BaseZhiyuEntity {

    /** 试卷 ID */
    private String examId;

    /** 考试名称 */
    private String name;

    /** 开始时间 */
    private OffsetDateTime startTime;

    /** 结束时间 */
    private OffsetDateTime endTime;

    /** 时长（分钟） */
    private Integer duration;

    /** 目标类型（class/major/department/public/task/node） */
    private String targetType;

    /** 状态（draft/published/finished） */
    private String status;

    /** 创建人（考试发起者） */
    @TableField("creator_id")
    private String creatorId;

    /** 租户 ID */
    private String tenantId;

    /** 激活模式（manual/scheduled） */
    private String activationMode;

    /** 绑定试卷版本（考试事件 ?v= 用） */
    private String examVersion;
}
