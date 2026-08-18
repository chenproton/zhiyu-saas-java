package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 考试安排（exam_usages 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("exam_usages")
public class EvaluationExamUsage extends BaseZhiyuEntity {

    /** 试卷 ID */
    private String examId;

    /** 考试名称 */
    private String name;

    /** 描述 */
    private String description;

    /** 开始时间 */
    private OffsetDateTime startTime;

    /** 结束时间 */
    private OffsetDateTime endTime;

    /** 时长（分钟） */
    private Integer duration;

    /** 目标类型（class/major/department/public/task/node/course） */
    private String targetType;

    /** 目标 ID 数组 */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> targetIds;

    /** 状态（draft/pending/published/scheduled/in_progress/finished） */
    private String status;

    /** 激活模式（manual/scheduled/always） */
    private String activationMode;

    /** 绑定试卷版本（发布/创建时固化的快照版本） */
    private String examVersion;

    /** 创建人 */
    private String creatorId;

    /** 专业 ID */
    private String majorId;

    /** 租户 ID */
    private String tenantId;
}
