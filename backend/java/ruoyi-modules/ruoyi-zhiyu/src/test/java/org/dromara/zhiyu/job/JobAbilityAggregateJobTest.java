package org.dromara.zhiyu.job;

import org.dromara.zhiyu.mapper.evaluation.JobRunLogMapper;
import org.dromara.zhiyu.service.evaluation.IEvaluationJobAbilityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 每日岗位能力汇聚定时任务单测（对齐 Go scheduler.go runJob 语义）。
 *
 * <p>覆盖：锁冲突跳过、失败重试一次、日志状态流转、开始记录写失败时的整体跳过、
 * 最终失败告警。</p>
 *
 * @author zhiyu
 */
@Tag("local")
class JobAbilityAggregateJobTest {

    private IEvaluationJobAbilityService jobAbilityService;
    private JobRunLogMapper jobRunLogMapper;
    private PgAdvisoryLockGuard advisoryLockGuard;
    private JobAlertWebhookSender alertSender;
    private JobAbilityAggregateJob job;

    @BeforeEach
    void setUp() throws Exception {
        jobAbilityService = mock(IEvaluationJobAbilityService.class);
        jobRunLogMapper = mock(JobRunLogMapper.class);
        advisoryLockGuard = mock(PgAdvisoryLockGuard.class);
        alertSender = mock(JobAlertWebhookSender.class);
        job = new JobAbilityAggregateJob(jobAbilityService, jobRunLogMapper, advisoryLockGuard, alertSender);
        when(jobRunLogMapper.insertRunning(JobAbilityAggregateJob.JOB_NAME)).thenReturn("log-1");
        // 默认取锁成功
        when(advisoryLockGuard.tryAcquire(JobAbilityAggregateJob.ADVISORY_LOCK_KEY))
            .thenReturn(mock(PgAdvisoryLockGuard.LockHandle.class));
    }

    @Test
    @DisplayName("锁冲突：拿不到 advisory lock 时跳过汇聚，日志记 success")
    void lockConflictSkipsAggregation() throws Exception {
        when(advisoryLockGuard.tryAcquire(JobAbilityAggregateJob.ADVISORY_LOCK_KEY)).thenReturn(null);

        job.runJob();

        verify(jobAbilityService, never()).aggregateAllPublished();
        // 执行记录仍落库：running → success（Go 语义：拿不到锁返回 nil 视为成功）
        verify(jobRunLogMapper).insertRunning(JobAbilityAggregateJob.JOB_NAME);
        verify(jobRunLogMapper).finish("log-1", "success", "");
        verify(alertSender, never()).send(anyString(), any(), any());
    }

    @Test
    @DisplayName("失败重试一次：首次抛错后重跑，重试成功则日志记 success 且不告警")
    void retriesOnceOnFailure() throws Exception {
        doThrow(new RuntimeException("db down"))
            .doNothing()
            .when(jobAbilityService).aggregateAllPublished();

        job.runJob();

        verify(jobAbilityService, times(2)).aggregateAllPublished();
        // retry 前的首次失败在日志中不可见（仅记录最终结果）
        verify(jobRunLogMapper).finish("log-1", "success", "");
        verify(alertSender, never()).send(anyString(), any(), any());
    }

    @Test
    @DisplayName("日志状态流转：两次均失败则日志记 failed 并触发一次告警")
    void finalFailureMarksFailedAndAlerts() throws Exception {
        RuntimeException boom = new RuntimeException("boom");
        doThrow(boom).when(jobAbilityService).aggregateAllPublished();

        job.runJob();

        verify(jobAbilityService, times(2)).aggregateAllPublished();
        verify(jobRunLogMapper).finish("log-1", "failed", "boom");
        verify(alertSender, times(1)).send(eq(JobAbilityAggregateJob.JOB_NAME), eq(boom), any());
    }

    @Test
    @DisplayName("panic 兜底：任务体抛 Error 同样走重试与 failed 收尾（对齐 Go panic recover）")
    void recoversErrorLikePanic() throws Exception {
        doThrow(new AssertionError("panic")).when(jobAbilityService).aggregateAllPublished();

        job.runJob();

        verify(jobAbilityService, times(2)).aggregateAllPublished();
        verify(jobRunLogMapper).finish(eq("log-1"), eq("failed"), anyString());
        verify(alertSender, times(1)).send(eq(JobAbilityAggregateJob.JOB_NAME), any(), any());
    }

    @Test
    @DisplayName("开始记录写失败：跳过回填与告警（对齐 Go finishJobRun 空 logID 提前返回）")
    void startLogFailureSkipsFinishAndAlert() throws Exception {
        when(jobRunLogMapper.insertRunning(JobAbilityAggregateJob.JOB_NAME))
            .thenThrow(new RuntimeException("log table missing"));

        job.runJob();

        // 任务本身仍执行
        verify(jobAbilityService, times(1)).aggregateAllPublished();
        verify(jobRunLogMapper, never()).finish(anyString(), anyString(), anyString());
        verify(alertSender, never()).send(anyString(), any(), any());
    }
}
