// Package scheduler 提供后台定时任务调度。
package scheduler

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
	"github.com/zhiyu-saas/backend/internal/service"
)

// Scheduler 包装 cron 调度器，Stop 时等待正在运行的任务结束。
type Scheduler struct {
	cron *cron.Cron
}

// Start 启动定时任务：每天 02:00 汇聚所有已发布认证规则的岗位能力结果。
func Start(pool *pgxpool.Pool) *Scheduler {
	agg := service.NewJobAbilityAggregator(pool)
	c := cron.New()
	if _, err := c.AddFunc("0 2 * * *", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		slog.Info("开始定时岗位能力汇聚")
		if err := agg.AggregateAllPublished(ctx); err != nil {
			slog.Error("定时岗位能力汇聚失败", "error", err)
		}
	}); err != nil {
		slog.Error("注册定时岗位能力汇聚任务失败", "error", err)
	}
	c.Start()
	return &Scheduler{cron: c}
}

// Stop 停止调度器并等待运行中的任务完成。
func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
}
