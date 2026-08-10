package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/zhiyu-saas/backend/internal/cache"
	"github.com/zhiyu-saas/backend/internal/config"
	"github.com/zhiyu-saas/backend/internal/db"
	"github.com/zhiyu-saas/backend/internal/geo"
	authmw "github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/router"
	"github.com/zhiyu-saas/backend/internal/scheduler"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	database, err := db.New(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	redisClient, err := cache.NewClient(cfg.RedisURL)
	if err != nil {
		slog.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}
	if redisClient == nil {
		slog.Warn("REDIS_URL not set, caching and rate limiting disabled")
	} else {
		defer redisClient.Close()
	}

	oplogBuffer := authmw.NewOpLogBuffer(database.Pool)
	defer oplogBuffer.Shutdown()

	geoSearcher := geo.NewSearcher(cfg.IP2RegionXDB)
	if geoSearcher == nil {
		slog.Warn("IP 归属地查询未启用（IP2REGION_XDB 未配置或加载失败），登录日志地点将为空")
	}

	r := router.New(database.Pool, cfg.JWTSecret, redisClient, oplogBuffer, geoSearcher, cfg.AISecret)
	defer r.Shutdown()

	sched := scheduler.Start(database.Pool)
	defer sched.Stop()

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 10 * time.Minute,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		slog.Info("starting server", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}
	slog.Info("server stopped")
}
