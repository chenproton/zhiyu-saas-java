package org.dromara.zhiyu.job;

import lombok.extern.slf4j.Slf4j;
import org.dromara.zhiyu.mapper.evaluation.JobRunLogMapper;
import org.dromara.zhiyu.service.evaluation.IEvaluationJobAbilityService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 每日岗位能力汇聚定时任务（对齐 Go scheduler.go 的 job-ability-aggregate）。
 *
 * <p>语义对照（逐条对齐 Go runJob/aggregateAll）：</p>
 * <ul>
 *   <li>cron 每天 02:00（Spring 6 段：{@code 0 0 2 * * *}）；</li>
 *   <li>SkipIfStillRunning：上一次未结束则跳过本次触发（{@link #running} 门闩，
 *       Spring 默认调度器单线程之外的防御）；</li>
 *   <li>单任务 30 分钟超时（虚拟线程 + Future.get 超时，对齐 Go context.WithTimeout）；</li>
 *   <li>失败自动重试 1 次；panic recover 兜底（执行体内 catch Throwable）；</li>
 *   <li>执行记录落库 job_run_logs：开始 INSERT status=running，结束 UPDATE
 *       finished_at/status/error；记录写失败不影响任务本身（尽力而为）；</li>
 *   <li>pg advisory lock 737001 防多实例并发，拿不到锁则跳过（视为成功）；</li>
 *   <li>最终失败时向 ALERT_WEBHOOK_URL POST JSON 告警（未配置跳过，失败仅记日志）。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Slf4j
@Component
public class JobAbilityAggregateJob {

    /** 任务名（job_run_logs.job_name，与 Go 一致） */
    public static final String JOB_NAME = "job-ability-aggregate";

    /** advisory lock key（与 Go 一致：737001） */
    public static final long ADVISORY_LOCK_KEY = 737001L;

    private final IEvaluationJobAbilityService jobAbilityService;
    private final JobRunLogMapper jobRunLogMapper;
    private final PgAdvisoryLockGuard advisoryLockGuard;
    private final JobAlertWebhookSender alertSender;

    /** SkipIfStillRunning 门闩 */
    private final AtomicBoolean running = new AtomicBoolean(false);

    /** 单任务超时（对齐 Go 30min；volatile 供测试缩短） */
    private volatile Duration jobTimeout = Duration.ofMinutes(30);

    public JobAbilityAggregateJob(IEvaluationJobAbilityService jobAbilityService,
                                  JobRunLogMapper jobRunLogMapper,
                                  PgAdvisoryLockGuard advisoryLockGuard,
                                  JobAlertWebhookSender alertSender) {
        this.jobAbilityService = jobAbilityService;
        this.jobRunLogMapper = jobRunLogMapper;
        this.advisoryLockGuard = advisoryLockGuard;
        this.alertSender = alertSender;
    }

    /** 每天 02:00 触发。 */
    @Scheduled(cron = "0 0 2 * * *")
    public void scheduled() {
        runJob();
    }

    /**
     * 统一执行入口（对齐 Go runJob）：panic recover + 失败重试 1 次 + 执行记录落库。
     */
    public void runJob() {
        if (!running.compareAndSet(false, true)) {
            log.info("定时任务仍在运行，跳过本次触发 job={}", JOB_NAME);
            return;
        }
        try {
            log.info("开始定时任务 job={}", JOB_NAME);
            OffsetDateTime started = OffsetDateTime.now();
            String logId = startJobRun();

            Throwable err = runOnce();
            if (err != null) {
                log.error("定时任务失败，重试一次 job={}", JOB_NAME, err);
                err = runOnce();
            }
            finishJobRun(logId, started, err);
        } finally {
            running.set(false);
        }
    }

    /**
     * 执行一次任务体：虚拟线程内运行并以 {@link #jobTimeout} 限时；
     * 任务体任何 Throwable（含 Error）均回收为返回值（对齐 Go panic recover）。
     */
    private Throwable runOnce() {
        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        Future<Throwable> future = executor.submit(() -> {
            try {
                aggregateWithLock();
                return null;
            } catch (Throwable t) {
                return t;
            }
        });
        try {
            return future.get(jobTimeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            return new RuntimeException("定时任务执行超时（超过 " + jobTimeout.toMinutes() + " 分钟）", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            future.cancel(true);
            return new RuntimeException("定时任务等待被中断", e);
        } catch (ExecutionException e) {
            return e.getCause() != null ? e.getCause() : e;
        } finally {
            executor.shutdownNow();
        }
    }

    /**
     * 汇聚主流程（对齐 Go aggregateAll）：advisory lock 737001 防多实例并发，
     * 拿不到锁则跳过（返回成功）；锁由专用连接持有，unlock 在 close 内尽力而为。
     */
    private void aggregateWithLock() throws Exception {
        try (PgAdvisoryLockGuard.LockHandle handle = advisoryLockGuard.tryAcquire(ADVISORY_LOCK_KEY)) {
            if (handle == null) {
                log.info("岗位能力汇聚已被其他实例执行，跳过本次 job={}", JOB_NAME);
                return;
            }
            jobAbilityService.aggregateAllPublished();
        }
    }

    /** 写入执行开始记录，返回日志 ID（写失败返回 null，后续跳过更新；对齐 Go startJobRun）。 */
    private String startJobRun() {
        try {
            return jobRunLogMapper.insertRunning(JOB_NAME);
        } catch (Exception e) {
            log.warn("定时任务执行记录写入失败 job={}", JOB_NAME, e);
            return null;
        }
    }

    /**
     * 回填执行结果（对齐 Go finishJobRun）：retry 前的首次失败在日志中不可见（仅记录最终结果）。
     * 日志行为空（开始记录写失败）时整体跳过（含告警），与 Go 提前 return 语义一致。
     */
    private void finishJobRun(String logId, OffsetDateTime started, Throwable err) {
        if (logId == null || logId.isEmpty()) {
            return;
        }
        String status = err == null ? "success" : "failed";
        String errorText = "";
        if (err != null) {
            errorText = err.getMessage() == null ? String.valueOf(err) : err.getMessage();
        }
        try {
            jobRunLogMapper.finish(logId, status, errorText);
        } catch (Exception e) {
            log.warn("定时任务执行记录回填失败 job={}", JOB_NAME, e);
        }
        if (err != null) {
            log.error("定时任务最终失败 job={} elapsed={}ms", JOB_NAME,
                Duration.between(started, OffsetDateTime.now()).toMillis(), err);
            alertSender.send(JOB_NAME, err, started);
        }
    }
}
