package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.OffsetDateTime;

/**
 * 定时任务执行记录（job_run_logs 表，Go 迁移 147 建表）。
 *
 * <p>表无 created_at/updated_at 列，基类审计字段不参与读写（本实体只配合注解 SQL 使用）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("job_run_logs")
public class JobRunLog extends BaseZhiyuEntity {

    /** 任务名（如 job-ability-aggregate） */
    private String jobName;

    /** 开始时间 */
    private OffsetDateTime startedAt;

    /** 结束时间 */
    private OffsetDateTime finishedAt;

    /** 状态（running/success/failed） */
    private String status;

    /** 影响行数（预留，Go 侧恒 0） */
    private Long rowsAffected;

    /** 失败原因 */
    private String error;
}
