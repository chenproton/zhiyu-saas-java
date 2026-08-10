// backfill-geo 一次性回填历史登录日志的 location（ip2region 按 IP 解析）。
// 用法：
//
//	IP2REGION_XDB=<xdb路径> DATABASE_URL=<数据库URL> go run ./cmd/backfill-geo
//
// 只更新 location IS NULL 且 IP 非空的行，幂等可重复执行。
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/geo"
)

func main() {
	xdb := os.Getenv("IP2REGION_XDB")
	if xdb == "" {
		xdb = "/app/data/ip2region_v4.xdb"
	}
	s := geo.NewSearcher(xdb)
	if s == nil {
		slog.Error("ip2region 加载失败，无法回填", "path", xdb)
		os.Exit(1)
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		slog.Error("DATABASE_URL 未设置")
		os.Exit(1)
	}
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		slog.Error("连接数据库失败", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	rows, err := pool.Query(context.Background(),
		`SELECT id, ip FROM login_logs WHERE location IS NULL AND ip IS NOT NULL AND ip <> ''`)
	if err != nil {
		slog.Error("查询待回填记录失败", "error", err)
		os.Exit(1)
	}
	type row struct{ id, ip string }
	var pending []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.ip); err != nil {
			slog.Error("扫描记录失败", "error", err)
			os.Exit(1)
		}
		pending = append(pending, r)
	}
	rows.Close()

	updated := 0
	for _, r := range pending {
		loc := s.Location(r.ip)
		if loc == "" {
			continue
		}
		if _, err := pool.Exec(context.Background(),
			`UPDATE login_logs SET location = $1 WHERE id = $2`, loc, r.id); err != nil {
			slog.Warn("回填失败", "id", r.id, "error", err)
			continue
		}
		updated++
	}
	fmt.Printf("共扫描 %d 条待回填记录，成功回填 %d 条\n", len(pending), updated)
}
