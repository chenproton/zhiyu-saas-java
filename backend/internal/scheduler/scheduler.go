// Package scheduler 提供后台定时任务调度。
package scheduler

import (
	"context"
	"log/slog"
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
	if _, err := c.AddFunc("0 2 * * *", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		slog.Info("开始定时岗位能力汇聚")
		if err := aggregateAll(ctx, pool); err != nil {
			slog.Error("定时岗位能力汇聚失败", "error", err)
		}
	}); err != nil {
		slog.Error("注册定时岗位能力汇聚任务失败", "error", err)
	}
	c.Start()
	return &Scheduler{cron: c}
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
