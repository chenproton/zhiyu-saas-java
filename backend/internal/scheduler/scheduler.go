// Package scheduler 提供后台定时任务调度。
package scheduler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// Scheduler 包装 cron 调度器，Stop 时等待正在运行的任务结束。
type Scheduler struct {
	cron *cron.Cron
}

// Start 启动定时任务：每天 02:00 汇聚所有已发布认证规则的岗位能力结果。
func Start(pool *pgxpool.Pool) *Scheduler {
	c := cron.New(cron.WithChain(cron.SkipIfStillRunning(cron.DefaultLogger)))
	register := func(spec, jobName string, fn func(ctx context.Context) error) {
		if _, err := c.AddFunc(spec, func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			runJob(ctx, pool, jobName, fn)
		}); err != nil {
			slog.Error("注册定时任务失败", "job", jobName, "error", err)
		}
	}
	register("0 2 * * *", "job-ability-aggregate", func(ctx context.Context) error {
		return aggregateAll(ctx, pool)
	})
	c.Start()
	return &Scheduler{cron: c}
}

// runJob 统一执行入口：panic recover + 失败重试 1 次 + 执行记录落库 job_run_logs。
// 执行记录写失败不影响任务本身（记录为尽力而为）。
func runJob(ctx context.Context, pool *pgxpool.Pool, jobName string, fn func(ctx context.Context) error) {
	slog.Info("开始定时任务", "job", jobName)
	started := time.Now()
	logID := startJobRun(ctx, pool, jobName)

	run := func() (err error) {
		defer func() {
			if rec := recover(); rec != nil {
				err = fmt.Errorf("panic: %v", rec)
			}
		}()
		return fn(ctx)
	}

	err := run()
	if err != nil {
		slog.Error("定时任务失败，重试一次", "job", jobName, "error", err)
		err = run()
	}
	finishJobRun(ctx, pool, logID, jobName, started, err)
}

// startJobRun 写入执行开始记录，返回日志 ID（写失败返回空串，后续跳过更新）。
func startJobRun(ctx context.Context, pool *pgxpool.Pool, jobName string) string {
	var id string
	err := pool.QueryRow(ctx, `INSERT INTO job_run_logs (job_name, status) VALUES ($1, 'running') RETURNING id`, jobName).Scan(&id)
	if err != nil {
		slog.Warn("定时任务执行记录写入失败", "job", jobName, "error", err)
		return ""
	}
	return id
}

// finishJobRun 回填执行结果；retry 前的首次失败在日志中不可见（仅记录最终结果），
// 重试语义由日志字段 status/error 体现。最终失败时触发告警 webhook（如已配置）。
func finishJobRun(ctx context.Context, pool *pgxpool.Pool, logID, jobName string, started time.Time, err error) {
	if logID == "" {
		return
	}
	status := "success"
	errorText := ""
	if err != nil {
		status = "failed"
		errorText = err.Error()
	}
	if _, uerr := pool.Exec(ctx,
		`UPDATE job_run_logs SET finished_at = $1, status = $2, error = $3 WHERE id = $4`,
		time.Now(), status, errorText, logID); uerr != nil {
		slog.Warn("定时任务执行记录回填失败", "job", jobName, "error", uerr)
	}
	if err != nil {
		slog.Error("定时任务最终失败", "job", jobName, "error", err, "elapsed", time.Since(started).String())
		notifyAlert(jobName, err, started)
	}
}

// alertWebhookURL 告警 webhook 出口（环境变量 ALERT_WEBHOOK_URL，可选）。
// 失败时以 JSON POST 通知外部系统（企业微信/钉钉/自建告警网关等），
// 通知失败仅记日志不影响任务主流程。
var alertWebhookURL = os.Getenv("ALERT_WEBHOOK_URL")

func notifyAlert(jobName string, err error, started time.Time) {
	if alertWebhookURL == "" {
		return
	}
	payload, merr := json.Marshal(map[string]any{
		"level":     "error",
		"type":      "cron_job_failed",
		"job":       jobName,
		"error":     err.Error(),
		"startedAt": started.Format(time.RFC3339),
	})
	if merr != nil {
		slog.Warn("定时任务告警 payload 序列化失败", "job", jobName, "error", merr)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, rerr := http.NewRequestWithContext(ctx, http.MethodPost, alertWebhookURL, bytes.NewReader(payload))
	if rerr != nil {
		slog.Warn("定时任务告警请求构造失败", "job", jobName, "error", rerr)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, herr := http.DefaultClient.Do(req)
	if herr != nil {
		slog.Warn("定时任务告警发送失败", "job", jobName, "error", herr)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		slog.Warn("定时任务告警被拒绝", "job", jobName, "status", resp.StatusCode)
	}
}

// aggregateAll 使用专用连接执行汇聚，解除全局 statement_timeout=15s 约束（单条汇聚语句可能超过 15 秒）。
func aggregateAll(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	// Release 前必须重置会话设置：pgxpool 回池不清理会话级变量，
	// 否则该物理连接永久失去 15s 语句超时保护，失控慢查询可挂死连接池
	defer func() {
		_, _ = conn.Exec(context.Background(), `RESET statement_timeout`)
		conn.Release()
	}()
	if _, err := conn.Exec(ctx, `SET statement_timeout = 0`); err != nil {
		return err
	}
	// 分布式锁：多实例部署时仅一个实例执行汇聚（advisory 会话锁，连接持有期间独占）
	var locked bool
	if err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock(737001)`).Scan(&locked); err != nil {
		return err
	}
	if !locked {
		slog.Info("岗位能力汇聚已被其他实例执行，跳过本次")
		return nil
	}
	defer func() {
		_, _ = conn.Exec(context.Background(), `SELECT pg_advisory_unlock(737001)`)
	}()
	agg := service.NewJobAbilityAggregator(store.NewConn(conn))
	return agg.AggregateAllPublished(ctx)
}

// Stop 停止调度器并等待运行中的任务完成（最长 2 分钟，避免容器停止时无限等待）。
func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	select {
	case <-ctx.Done():
	case <-time.After(2 * time.Minute):
		slog.Warn("等待定时任务结束超时，强制返回")
	}
}
